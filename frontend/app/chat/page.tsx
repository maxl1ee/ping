'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, Zap, Loader2 } from 'lucide-react';
import { chatApi, nexusApi } from '@/lib/api';

interface Message {
  id: string;
  senderType: 'user' | 'agent' | 'network';
  content: string;
  messageType: 'text' | 'insight' | 'signal';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState('Your Agent');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    const onboarded = localStorage.getItem('ping_onboarded');
    if (!onboarded) { router.push('/onboarding'); return; }
    loadChat();
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChat = async () => {
    try {
      const data = await chatApi.getHistory(50);
      setMessages(data.messages || []);

      if ((!data.messages || data.messages.length === 0)) {
        try {
          const welcome = await chatApi.getWelcome();
          if (welcome.welcome) {
            setMessages([{
              id: `welcome-${Date.now()}`,
              senderType: 'agent',
              content: welcome.welcome,
              messageType: 'text',
              createdAt: new Date().toISOString(),
            }]);
          }
        } catch {}
      }
    } catch {
      // Chat not available yet
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      senderType: 'user',
      content,
      messageType: 'text',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setSending(true);

    try {
      const response = await chatApi.send(content);
      const agentMsg: Message = {
        id: response.agentMessage?.id || `reply-${Date.now()}`,
        senderType: 'agent',
        content: response.agentMessage?.content || 'Got it.',
        messageType: 'text',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      // keep user message
    } finally {
      setSending(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await nexusApi.syncInsights();
      if (result.delivered > 0) {
        // Reload to show new insight messages
        const data = await chatApi.getHistory(50);
        setMessages(data.messages || []);
      } else {
        const noNewsMsg: Message = {
          id: `sync-${Date.now()}`,
          senderType: 'agent',
          content: 'Checked the network — nothing new right now. I\'ll keep looking. 🏓',
          messageType: 'text',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, noNewsMsg]);
      }
    } catch {
      // Network not available
    } finally {
      setSyncing(false);
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
    <div className="flex flex-col h-screen max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">{agentName}</p>
            <p className="text-xs text-ping-green">Connected to Nexus</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Sync
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-sm text-slate-500">Setting up your agent...</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.messageType === 'insight' || msg.senderType === 'network' ? (
              <div className="max-w-[85%]">
                <div className="bg-surface border border-accent/20 rounded-2xl rounded-bl-md p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="w-3 h-3 text-accent" />
                    <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Network Intel</span>
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[10px] text-slate-600 mt-1.5">{timeAgo(msg.createdAt)}</p>
                </div>
              </div>
            ) : (
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.senderType === 'user'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-surface border border-surface-border text-slate-200 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface border border-surface-border px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-surface-border mb-[4.5rem]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="input-field flex-1 py-2.5"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
