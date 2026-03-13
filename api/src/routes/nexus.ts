// Nexus integration routes — proxy/client for the Nexus A2A network
import logger from '../lib/logger';
import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db, agents } from '../db';
import { eq } from 'drizzle-orm';
import {
  getInbox,
  submitFeedback,
  queryNetwork,
  getConversations,
  getAgentStats,
} from '../services/nexus';
import { deliverInsight } from '../services/chat';

const router = Router();

// Helper: get user's Nexus API key
async function getNexusKey(userId: string): Promise<{ apiKey: string; agent: typeof agents.$inferSelect } | null> {
  const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));
  if (!agent || !agent.nexusApiKey) return null;
  return { apiKey: agent.nexusApiKey, agent };
}

// GET /api/nexus/inbox — get signals routed to this agent
router.get('/inbox', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || 'pending';

    const inbox = await getInbox(nexus.apiKey, { status, limit });

    res.json({ inbox });
  } catch (error) {
    logger.error({ err: error }, 'Get inbox error');
    res.status(500).json({ error: 'Failed to get inbox' });
  }
});

// POST /api/nexus/inbox/:id/feedback — mark a signal as useful/irrelevant/spam
router.post('/inbox/:id/feedback', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const { feedback } = req.body;
    if (!['useful', 'irrelevant', 'spam'].includes(feedback)) {
      return res.status(400).json({ error: 'Invalid feedback. Use: useful, irrelevant, spam' });
    }

    const success = await submitFeedback(nexus.apiKey, req.params.id, feedback);

    res.json({ success });
  } catch (error) {
    logger.error({ err: error }, 'Submit feedback error');
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// POST /api/nexus/query — search the network for relevant agents
router.post('/query', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await queryNetwork(nexus.apiKey, query);

    res.json({ results });
  } catch (error) {
    logger.error({ err: error }, 'Query error');
    res.status(500).json({ error: 'Failed to query network' });
  }
});

// GET /api/nexus/conversations — get A2A conversations
router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const convos = await getConversations(nexus.apiKey, { status, limit });

    res.json({ conversations: convos });
  } catch (error) {
    logger.error({ err: error }, 'Get conversations error');
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// GET /api/nexus/stats — get agent network stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const stats = await getAgentStats(nexus.apiKey);

    res.json({ stats });
  } catch (error) {
    logger.error({ err: error }, 'Get stats error');
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// POST /api/nexus/sync-insights — pull inbox and deliver as chat insights
router.post('/sync-insights', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nexus = await getNexusKey(req.userId!);
    if (!nexus) return res.status(404).json({ error: 'Agent not registered on Nexus' });

    const inbox = await getInbox(nexus.apiKey, { status: 'pending', limit: 10 });

    const delivered: string[] = [];
    for (const item of inbox) {
      if (item.tier === 'push') {
        await deliverInsight(req.userId!, {
          content: `📡 **${item.signal.emitterName}**: ${item.signal.content}`,
          source: item.signal.emitterName,
          signalId: item.signalId,
        });
        delivered.push(item.id);
      }
    }

    res.json({ delivered: delivered.length, total: inbox.length });
  } catch (error) {
    logger.error({ err: error }, 'Sync insights error');
    res.status(500).json({ error: 'Failed to sync insights' });
  }
});

export default router;
