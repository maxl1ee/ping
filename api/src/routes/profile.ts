// Profile routes — agent profile CRUD, onboarding, stats
import logger from '../lib/logger';
import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db, agents, agentProfiles } from '../db';
import { eq } from 'drizzle-orm';
import { registerOnNexus, updateNexusProfile, getAgentStats } from '../services/nexus';
import { generateJSON } from '../services/llm';

const router = Router();

// ─── Onboarding schema ──────────────────────────────────────────────────────

const onboardingSchema = z.object({
  agentName: z.string().min(1).max(100),
  // Step 1: What you know
  expertise: z.array(z.string()).max(10).default([]),
  experiences: z.array(z.string()).max(10).default([]),
  opinions: z.array(z.string()).max(10).default([]),
  // Step 2: What you're looking for
  activeQuestions: z.array(z.string()).max(10).default([]),
  goals: z.array(z.string()).max(5).default([]),
  decisions: z.array(z.string()).max(5).default([]),
  // Step 3: Where you're based
  localKnowledge: z.array(z.string()).max(5).default([]),
  // Step 4: Agent behavior
  conversationStyle: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
});

// POST /api/profile/onboard — complete onboarding + register on Nexus
router.post('/onboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = onboardingSchema.parse(req.body);

    // Check if already has an agent
    const [existingAgent] = await db.select().from(agents).where(eq(agents.userId, userId));
    if (existingAgent && existingAgent.onboardingComplete) {
      return res.status(409).json({ error: 'Onboarding already completed' });
    }

    // Generate supply/demand summaries using LLM
    const summaries = await generateJSON<{ supply_summary: string; demand_summary: string }>(
      `Generate concise supply and demand summaries for an agent profile.
Supply = what this person knows and can offer.
Demand = what this person needs and is looking for.
Return JSON: { "supply_summary": "...", "demand_summary": "..." }`,
      `Profile:
Expertise: ${data.expertise.join(', ') || 'none'}
Experiences: ${data.experiences.join(', ') || 'none'}
Opinions: ${data.opinions.join(', ') || 'none'}
Local knowledge: ${data.localKnowledge.join(', ') || 'none'}
Active questions: ${data.activeQuestions.join(', ') || 'none'}
Goals: ${data.goals.join(', ') || 'none'}
Decisions: ${data.decisions.join(', ') || 'none'}`,
      { temperature: 0.3, maxTokens: 300 }
    );

    // Register on Nexus
    let nexusAgentId: string | null = null;
    let nexusApiKey: string | null = null;

    try {
      const nexusResult = await registerOnNexus({
        name: data.agentName,
        supplySummary: summaries.supply_summary,
        demandSummary: summaries.demand_summary,
        conversationStyle: data.conversationStyle,
        expertise: data.expertise,
        experiences: data.experiences,
        opinions: data.opinions,
        localKnowledge: data.localKnowledge,
        activeQuestions: data.activeQuestions,
        goals: data.goals,
        decisions: data.decisions,
      });
      nexusAgentId = nexusResult.agentId;
      nexusApiKey = nexusResult.apiKey;
      logger.info({ nexusAgentId }, 'Agent registered on Nexus');
    } catch (error) {
      logger.warn({ err: error }, 'Nexus registration failed — continuing without network');
    }

    // Create or update agent
    let agent;
    if (existingAgent) {
      [agent] = await db
        .update(agents)
        .set({
          name: data.agentName,
          nexusAgentId,
          nexusApiKey,
          supplySummary: summaries.supply_summary,
          demandSummary: summaries.demand_summary,
          conversationStyle: data.conversationStyle,
          onboardingComplete: true,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, existingAgent.id))
        .returning();
    } else {
      [agent] = await db
        .insert(agents)
        .values({
          userId,
          name: data.agentName,
          nexusAgentId,
          nexusApiKey,
          supplySummary: summaries.supply_summary,
          demandSummary: summaries.demand_summary,
          conversationStyle: data.conversationStyle,
          onboardingComplete: true,
        })
        .returning();
    }

    // Create/update profile
    const [existingProfile] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agent.id));
    if (existingProfile) {
      await db.update(agentProfiles).set({
        expertise: data.expertise,
        experiences: data.experiences,
        opinions: data.opinions,
        localKnowledge: data.localKnowledge,
        activeQuestions: data.activeQuestions,
        goals: data.goals,
        decisions: data.decisions,
      }).where(eq(agentProfiles.agentId, agent.id));
    } else {
      await db.insert(agentProfiles).values({
        agentId: agent.id,
        expertise: data.expertise,
        experiences: data.experiences,
        opinions: data.opinions,
        localKnowledge: data.localKnowledge,
        activeQuestions: data.activeQuestions,
        goals: data.goals,
        decisions: data.decisions,
      });
    }

    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        supplySummary: agent.supplySummary,
        demandSummary: agent.demandSummary,
        nexusConnected: !!nexusAgentId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error({ err: error }, 'Onboarding error');
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// GET /api/profile — get agent profile
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));

    if (!agent) {
      return res.json({ agent: null, profile: null });
    }

    const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agent.id));

    // Get Nexus stats if connected
    let nexusStats = null;
    if (agent.nexusApiKey) {
      nexusStats = await getAgentStats(agent.nexusApiKey).catch(() => null);
    }

    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        supplySummary: agent.supplySummary,
        demandSummary: agent.demandSummary,
        conversationStyle: agent.conversationStyle,
        nexusConnected: !!agent.nexusAgentId,
        onboardingComplete: agent.onboardingComplete,
        createdAt: agent.createdAt,
      },
      profile: profile || null,
      nexusStats,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get profile error');
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/profile — update agent profile
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));
    if (!agent) return res.status(404).json({ error: 'No agent found' });

    const { expertise, experiences, opinions, localKnowledge, activeQuestions, goals, decisions } = req.body;

    // Update local profile
    await db.update(agentProfiles).set({
      ...(expertise && { expertise }),
      ...(experiences && { experiences }),
      ...(opinions && { opinions }),
      ...(localKnowledge && { localKnowledge }),
      ...(activeQuestions && { activeQuestions }),
      ...(goals && { goals }),
      ...(decisions && { decisions }),
    }).where(eq(agentProfiles.agentId, agent.id));

    // Sync to Nexus if connected
    if (agent.nexusApiKey) {
      await updateNexusProfile(agent.nexusApiKey, {
        expertise,
        experiences,
        opinions,
        localKnowledge,
        activeQuestions,
        goals,
        decisions,
      }).catch((err) => {
        logger.warn({ err }, 'Nexus profile sync failed');
      });
    }

    await db.update(agents).set({ updatedAt: new Date() }).where(eq(agents.id, agent.id));

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Update profile error');
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
