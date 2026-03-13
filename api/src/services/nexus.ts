// Nexus Client Service — connects Ping agents to the Nexus A2A network
// Handles: registration, signal emission, inbox polling, conversation management
import logger from '../lib/logger';

const NEXUS_API_URL = process.env.NEXUS_API_URL || 'http://localhost:3001';

interface NexusResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function nexusFetch<T = unknown>(
  path: string,
  apiKey: string | null,
  options: RequestInit = {}
): Promise<NexusResponse<T>> {
  const url = `${NEXUS_API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const body = await response.json() as Record<string, any>;

    if (!response.ok) {
      return { ok: false, error: body.error || `HTTP ${response.status}` };
    }

    return { ok: true, data: body as T };
  } catch (error) {
    logger.error({ err: error, path }, 'Nexus API call failed');
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// ─── Registration ────────────────────────────────────────────────────────────

interface RegisterResult {
  agentId: string;
  apiKey: string;
}

export async function registerOnNexus(profile: {
  name: string;
  supplySummary: string;
  demandSummary: string;
  conversationStyle: string;
  expertise: string[];
  experiences: string[];
  opinions: string[];
  localKnowledge: string[];
  activeQuestions: string[];
  goals: string[];
  decisions: string[];
}): Promise<RegisterResult> {
  const response = await nexusFetch<{ agent: { id: string }; apiKey: string }>(
    '/api/agents/register',
    null,
    {
      method: 'POST',
      body: JSON.stringify({
        name: profile.name,
        supply_summary: profile.supplySummary,
        demand_summary: profile.demandSummary,
        conversation_style: profile.conversationStyle,
        privacy_level: 'network',
        profile: {
          expertise: profile.expertise,
          experiences: profile.experiences,
          opinions: profile.opinions,
          local_knowledge: profile.localKnowledge,
          active_questions: profile.activeQuestions,
          goals: profile.goals,
          decisions: profile.decisions,
        },
      }),
    }
  );

  if (!response.ok || !response.data) {
    throw new Error(`Nexus registration failed: ${response.error}`);
  }

  return {
    agentId: response.data.agent.id,
    apiKey: response.data.apiKey,
  };
}

// ─── Update Profile ──────────────────────────────────────────────────────────

export async function updateNexusProfile(
  apiKey: string,
  profile: {
    supplySummary?: string;
    demandSummary?: string;
    expertise?: string[];
    experiences?: string[];
    opinions?: string[];
    localKnowledge?: string[];
    activeQuestions?: string[];
    goals?: string[];
    decisions?: string[];
  }
): Promise<boolean> {
  const response = await nexusFetch('/api/agents/me/profile', apiKey, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });

  return response.ok;
}

// ─── Emit Signal ─────────────────────────────────────────────────────────────

interface EmitResult {
  signalId: string;
  routing: { push: number; digest: number; stored: number };
}

export async function emitSignal(
  apiKey: string,
  signal: {
    content: string;
    signalType: 'question' | 'intent' | 'update' | 'offer';
  }
): Promise<EmitResult | null> {
  const response = await nexusFetch<{ signal: { id: string }; routing: EmitResult['routing'] }>(
    '/api/signals/emit',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        content: signal.content,
        signal_type: signal.signalType,
      }),
    }
  );

  if (!response.ok || !response.data) {
    logger.warn({ error: response.error }, 'Signal emission failed');
    return null;
  }

  return {
    signalId: response.data.signal.id,
    routing: response.data.routing,
  };
}

// ─── Get Inbox ───────────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  signalId: string;
  tier: string;
  relevanceScore: number;
  signal: {
    content: string;
    signalType: string;
    emitterName: string;
    topics: string[];
    createdAt: string;
  };
  feedback?: string;
}

export async function getInbox(
  apiKey: string,
  options: { status?: string; limit?: number } = {}
): Promise<InboxItem[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));

  const response = await nexusFetch<{ inbox: InboxItem[] }>(
    `/api/signals/inbox?${params.toString()}`,
    apiKey
  );

  return response.ok && response.data ? response.data.inbox : [];
}

// ─── Submit Feedback ─────────────────────────────────────────────────────────

export async function submitFeedback(
  apiKey: string,
  routingId: string,
  feedback: 'useful' | 'irrelevant' | 'spam'
): Promise<boolean> {
  const response = await nexusFetch(`/api/signals/inbox/${routingId}/feedback`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });

  return response.ok;
}

// ─── Query Network ───────────────────────────────────────────────────────────

interface QueryResult {
  agentId: string;
  agentName: string;
  score: number;
  reason: string;
  matchType: string;
}

export async function queryNetwork(
  apiKey: string,
  query: string
): Promise<QueryResult[]> {
  const response = await nexusFetch<{ results: QueryResult[] }>(
    '/api/agents/query',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    }
  );

  return response.ok && response.data ? response.data.results : [];
}

// ─── Start Conversation ──────────────────────────────────────────────────────

export async function startConversation(
  apiKey: string,
  targetAgentId: string,
  signalId?: string
): Promise<string | null> {
  const response = await nexusFetch<{ conversationId: string }>(
    '/api/conversations/start',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({ targetAgentId, signalId }),
    }
  );

  return response.ok && response.data ? response.data.conversationId : null;
}

// ─── Reply in Conversation ───────────────────────────────────────────────────

interface ConversationState {
  id: string;
  status: string;
  currentPhase: string;
  turnCount: number;
  shouldStop: boolean;
  stopReason?: string;
}

export async function replyInConversation(
  apiKey: string,
  conversationId: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<ConversationState | null> {
  const response = await nexusFetch<ConversationState>(
    `/api/conversations/${conversationId}/reply`,
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({ message, metadata }),
    }
  );

  return response.ok && response.data ? response.data : null;
}

// ─── Get Conversations ───────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  status: string;
  currentPhase: string;
  turnCount: number;
  infoDensity?: number;
  reciprocity?: number;
  specificity?: number;
  relevanceScore?: number;
  startedAt: string;
  completedAt?: string;
}

export async function getConversations(
  apiKey: string,
  options: { status?: string; limit?: number } = {}
): Promise<ConversationSummary[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));

  const response = await nexusFetch<{ conversations: ConversationSummary[] }>(
    `/api/conversations?${params.toString()}`,
    apiKey
  );

  return response.ok && response.data ? response.data.conversations : [];
}

// ─── Get Agent Stats ─────────────────────────────────────────────────────────

interface AgentStats {
  totalConversations: number;
  totalSignals: number;
  reputationScore: number;
  reputation?: {
    responseQuality: number;
    senderTrust: number;
    matchSuccessRate: number;
  };
}

export async function getAgentStats(apiKey: string): Promise<AgentStats | null> {
  const response = await nexusFetch<AgentStats>('/api/dashboard/reputation', apiKey);
  return response.ok && response.data ? response.data : null;
}
