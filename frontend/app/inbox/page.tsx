'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox as InboxIcon, ThumbsUp, ThumbsDown, AlertTriangle, Loader2 } from 'lucide-react';
import { nexusApi } from '@/lib/api';

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

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    loadInbox();
  }, [router]);

  const loadInbox = async () => {
    try {
      const data = await nexusApi.getInbox(30);
      setItems(data.inbox || []);
    } catch {
      // Not connected to Nexus yet
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (routingId: string, feedback: 'useful' | 'irrelevant' | 'spam') => {
    setFeedbackLoading(routingId);
    try {
      await nexusApi.submitFeedback(routingId, feedback);
      setItems((prev) =>
        prev.map((item) =>
          item.id === routingId ? { ...item, feedback } : item
        )
      );
    } catch {
      // Failed — silently ignore
    } finally {
      setFeedbackLoading(null);
    }
  };

  const signalTypeIcon = (type: string) => {
    switch (type) {
      case 'question': return '❓';
      case 'intent': return '🎯';
      case 'update': return '📢';
      case 'offer': return '🤝';
      default: return '📡';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <InboxIcon className="w-6 h-6 text-accent" />
        <h1 className="text-xl font-bold text-slate-100">Inbox</h1>
        <span className="badge bg-accent/15 text-accent">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <InboxIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No signals yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Keep chatting with your agent — the network will find relevant people for you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{signalTypeIcon(item.signal.signalType)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-accent">{item.signal.emitterName}</span>
                    <span className="text-[10px] text-slate-500 capitalize">{item.signal.signalType}</span>
                    <span className="text-[10px] text-slate-600">
                      {Math.round(item.relevanceScore * 100)}% match
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.signal.content}</p>
                  {item.signal.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.signal.topics.map((topic) => (
                        <span key={topic} className="badge bg-surface-light text-slate-400">{topic}</span>
                      ))}
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="flex items-center gap-2 mt-3">
                    {item.feedback ? (
                      <span className={`text-xs font-medium ${
                        item.feedback === 'useful' ? 'text-ping-green' :
                        item.feedback === 'spam' ? 'text-ping-red' : 'text-slate-500'
                      }`}>
                        Marked as {item.feedback}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFeedback(item.id, 'useful')}
                          disabled={feedbackLoading === item.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-ping-green hover:bg-ping-green/10 transition-colors"
                        >
                          {feedbackLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                          Useful
                        </button>
                        <button
                          onClick={() => handleFeedback(item.id, 'irrelevant')}
                          disabled={feedbackLoading === item.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-surface-light transition-colors"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          Irrelevant
                        </button>
                        <button
                          onClick={() => handleFeedback(item.id, 'spam')}
                          disabled={feedbackLoading === item.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-ping-red hover:bg-ping-red/10 transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Spam
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
