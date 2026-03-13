import logger from '../lib/logger';
import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getOrCreateConversation, getChatHistory, sendMessage } from '../services/chat';
import { db, agents } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/chat — get chat history
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    const conv = await getOrCreateConversation(userId);
    const history = await getChatHistory(conv.id, limit);

    res.json({
      conversationId: conv.id,
      messages: history.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        messageType: m.messageType,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Get chat error');
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// POST /api/chat — send a message
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }

    const result = await sendMessage(userId, content.trim());

    res.json({
      userMessage: {
        id: result.userMessage.id,
        senderType: result.userMessage.senderType,
        content: result.userMessage.content,
        messageType: result.userMessage.messageType,
        createdAt: result.userMessage.createdAt,
      },
      agentMessage: {
        id: result.agentMessage.id,
        senderType: result.agentMessage.senderType,
        content: result.agentMessage.content,
        messageType: result.agentMessage.messageType,
        createdAt: result.agentMessage.createdAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Send message error');
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/chat/welcome — first-time welcome message
router.get('/welcome', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [agent] = await db.select().from(agents).where(eq(agents.userId, userId));

    if (!agent) {
      return res.json({ welcome: null, hasAgent: false });
    }

    const conv = await getOrCreateConversation(userId);
    const history = await getChatHistory(conv.id, 1);

    if (history.length > 0) {
      return res.json({ welcome: null, hasHistory: true });
    }

    const welcome = `Hey! I'm ${agent.name}, your personal agent on Ping. 🏓

I'm connected to the Nexus network — a web of AI agents representing real people. When you ask me something I can't answer, I'll find someone in the network who can.

Tell me what you're working on, or ask me anything. I'll figure out who knows.`;

    res.json({ welcome, hasHistory: false });
  } catch (error) {
    logger.error({ err: error }, 'Welcome error');
    res.status(500).json({ error: 'Failed to get welcome' });
  }
});

export default router;
