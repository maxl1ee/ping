// Chat Service — manages user ↔ agent conversation
// Extracts signals from conversation and emits to Nexus in background
import logger from '../lib/logger';
import { db, agents, agentProfiles, conversations, messages } from '../db';
import { eq, desc } from 'drizzle-orm';
import { generateCompletion, generateJSON } from './llm';
import { emitSignal } from './nexus';

// ─── Get or create conversation for user ─────────────────────────────────────

export async function getOrCreateConversation(userId: string): Promise<{ id: string; status: string }> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (existing) return { id: existing.id, status: existing.status };

  const [conv] = await db
    .insert(conversations)
    .values({ userId, status: 'active' })
    .returning();

  return { id: conv.id, status: conv.status };
}

// ─── Get chat history ────────────────────────────────────────────────────────

export async function getChatHistory(conversationId: string, limit: number = 50) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

// ─── Send message and get agent reply ────────────────────────────────────────

export async function sendMessage(
  userId: string,
  content: string
): Promise<{ userMessage: typeof messages.$inferSelect; agentMessage: typeof messages.$inferSelect }> {
  // Get agent
  const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));
  if (!agent) throw new Error('No agent found for user');

  // Get profile for context
  const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agent.id));

  // Get or create conversation
  const conv = await getOrCreateConversation(userId);

  // Store user message
  const [userMsg] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      senderType: 'user',
      content,
      messageType: 'text',
    })
    .returning();

  // Get recent history for context
  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(desc(messages.createdAt))
    .limit(10);

  const history = recentMessages.reverse();

  // Build context
  const contextLines = history.map((m) => {
    const sender = m.senderType === 'user' ? 'User' : (m.senderType === 'network' ? 'Network Intel' : agent.name);
    return `${sender}: ${m.content}`;
  }).join('\n');

  const expertiseStr = profile?.expertise?.length ? `Expertise: ${(profile.expertise as string[]).join(', ')}` : '';
  const goalsStr = profile?.goals?.length ? `Goals: ${(profile.goals as string[]).join(', ')}` : '';
  const questionsStr = profile?.activeQuestions?.length ? `Looking for: ${(profile.activeQuestions as string[]).join(', ')}` : '';

  const system = `You are ${agent.name}, a personal AI agent on the Ping network. Your job is to help your user and represent them on the Nexus agent network.

Your user's profile:
${expertiseStr}
${goalsStr}
${questionsStr}

You are friendly, concise, and genuinely helpful. You remember context from the conversation.
When your user asks something you can't answer from context, let them know you'll check the network for someone who knows.
Keep responses to 1-3 sentences unless the user asks for detail.`;

  const userPrompt = `Conversation:\n${contextLines}\n\nUser: ${content}\n\nRespond as ${agent.name}:`;

  // Generate agent reply
  const response = await generateCompletion(system, userPrompt, {
    temperature: 0.7,
    maxTokens: 500,
  });

  // Store agent reply
  const [agentMsg] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      senderType: 'agent',
      content: response.content,
      messageType: 'text',
    })
    .returning();

  // Background: extract signals and emit to Nexus
  extractAndEmitSignal(agent, content).catch((err) => {
    logger.error({ err }, 'Background signal extraction failed');
  });

  return { userMessage: userMsg, agentMessage: agentMsg };
}

// ─── Signal Extraction (background) ──────────────────────────────────────────

interface ExtractedSignal {
  should_emit: boolean;
  signal_type: 'question' | 'intent' | 'update' | 'offer';
  content: string;
  reason: string;
}

async function extractAndEmitSignal(
  agent: typeof agents.$inferSelect,
  userMessage: string
): Promise<void> {
  if (!agent.nexusApiKey) return; // Not registered on Nexus yet

  try {
    const extracted = await generateJSON<ExtractedSignal>(
      `You are a signal extraction engine. Analyze the user's message and determine if it contains a signal worth emitting to the agent network.

Emit a signal when the user:
- Asks a question you can't answer (→ question signal)
- Expresses a goal or intent (→ intent signal)
- Shares a life update or status change (→ update signal)
- Offers help or expertise (→ offer signal)

Do NOT emit for:
- Casual greetings or small talk
- Questions the agent can answer from its own knowledge
- Very personal/private information
- Follow-up questions in an ongoing topic that was already emitted

Return JSON:
{
  "should_emit": true/false,
  "signal_type": "question" | "intent" | "update" | "offer",
  "content": "the signal to emit — rewritten for the network, in third person",
  "reason": "brief reason for decision"
}`,
      `User message: "${userMessage}"`,
      { temperature: 0.3, maxTokens: 300 }
    );

    if (extracted.should_emit && extracted.content) {
      const result = await emitSignal(agent.nexusApiKey, {
        content: extracted.content,
        signalType: extracted.signal_type,
      });

      if (result) {
        logger.info({
          agentId: agent.id,
          signalType: extracted.signal_type,
          routing: result.routing,
        }, 'Signal emitted to Nexus');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Signal extraction/emission failed');
  }
}

// ─── Deliver Network Insight ─────────────────────────────────────────────────

export async function deliverInsight(
  userId: string,
  insight: {
    content: string;
    source?: string;
    conversationId?: string;
    signalId?: string;
  }
): Promise<typeof messages.$inferSelect> {
  const conv = await getOrCreateConversation(userId);

  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      senderType: 'network',
      content: insight.content,
      messageType: 'insight',
      metadata: {
        source: insight.source,
        nexusConversationId: insight.conversationId,
        signalId: insight.signalId,
      },
    })
    .returning();

  return msg;
}
