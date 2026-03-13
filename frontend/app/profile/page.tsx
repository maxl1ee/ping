'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Wifi, WifiOff, BarChart3, LogOut, ChevronRight, Edit2, Save, X, Loader2 } from 'lucide-react';
import { profileApi, nexusApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface AgentData {
  id: string;
  name: string;
  supplySummary: string | null;
  demandSummary: string | null;
  conversationStyle: string;
  nexusConnected: boolean;
  onboardingComplete: boolean;
  createdAt: string;
}

interface ProfileData {
  expertise: string[];
  experiences: string[];
  opinions: string[];
  localKnowledge: string[];
  activeQuestions: string[];
  goals: string[];
  decisions: string[];
}

interface NexusStats {
  totalConversations: number;
  totalSignals: number;
  reputationScore: number;
  reputation?: {
    responseQuality: number;
    senderTrust: number;
    matchSuccessRate: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<NexusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      const data = await profileApi.get();
      setAgent(data.agent);
      setProfile(data.profile);
      if (data.nexusStats) setStats(data.nexusStats);
    } catch {
      // Not set up yet
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (field: string, currentValues: string[]) => {
    setEditing(field);
    setEditValue(currentValues.join('\n'));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async (field: string) => {
    if (!profile) return;
    setSaving(true);
    try {
      const values = editValue.split('\n').map(v => v.trim()).filter(Boolean);
      await profileApi.update({ [field]: values });
      setProfile({ ...profile, [field]: values });
      setEditing(null);
      setEditValue('');
    } catch {
      // Failed
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <User className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400 font-medium">No agent yet</p>
        <button
          onClick={() => router.push('/onboarding')}
          className="btn-primary mt-4"
        >
          Set up your agent
        </button>
      </div>
    );
  }

  const supplyFields = [
    { key: 'expertise', label: 'Expertise', emoji: '🧠' },
    { key: 'experiences', label: 'Experiences', emoji: '📖' },
    { key: 'opinions', label: 'Opinions', emoji: '💬' },
    { key: 'localKnowledge', label: 'Local Knowledge', emoji: '📍' },
  ];

  const demandFields = [
    { key: 'activeQuestions', label: 'Questions', emoji: '❓' },
    { key: 'goals', label: 'Goals', emoji: '🎯' },
    { key: 'decisions', label: 'Decisions', emoji: '⚖️' },
  ];

  return (
    <div className="min-h-screen px-4 pt-6 max-w-lg mx-auto pb-24">
      {/* Agent Header */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
            <User className="w-7 h-7 text-accent" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-100">{agent.name}</h1>
            <p className="text-sm text-slate-400">{user?.name}&apos;s agent</p>
            <div className="flex items-center gap-1.5 mt-1">
              {agent.nexusConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-ping-green" />
                  <span className="text-xs text-ping-green">Connected to Nexus</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-500">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summaries */}
        {agent.supplySummary && (
          <div className="mt-4 pt-4 border-t border-surface-border">
            <p className="text-xs font-semibold text-ping-green uppercase tracking-wide mb-1">What you offer</p>
            <p className="text-sm text-slate-300 leading-relaxed">{agent.supplySummary}</p>
          </div>
        )}
        {agent.demandSummary && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">What you need</p>
            <p className="text-sm text-slate-300 leading-relaxed">{agent.demandSummary}</p>
          </div>
        )}
      </div>

      {/* Network Stats */}
      {stats && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Network Stats</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-slate-100">{stats.totalConversations}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Conversations</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-slate-100">{stats.totalSignals}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Signals</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-accent">{Math.round(stats.reputationScore * 100)}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Reputation</p>
            </div>
          </div>
          {stats.reputation && (
            <div className="card mt-3">
              <div className="space-y-2">
                <StatBar label="Response Quality" value={stats.reputation.responseQuality} />
                <StatBar label="Sender Trust" value={stats.reputation.senderTrust} />
                <StatBar label="Match Success" value={stats.reputation.matchSuccessRate} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supply (What You Know) */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-ping-green uppercase tracking-wide mb-3">What You Know</h2>
        <div className="space-y-3">
          {supplyFields.map(({ key, label, emoji }) => (
            <ProfileSection
              key={key}
              fieldKey={key}
              label={label}
              emoji={emoji}
              values={(profile as any)?.[key] || []}
              editing={editing}
              editValue={editValue}
              saving={saving}
              onEdit={startEdit}
              onCancel={cancelEdit}
              onSave={saveEdit}
              onEditValueChange={setEditValue}
            />
          ))}
        </div>
      </div>

      {/* Demand (What You Need) */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-accent uppercase tracking-wide mb-3">What You Need</h2>
        <div className="space-y-3">
          {demandFields.map(({ key, label, emoji }) => (
            <ProfileSection
              key={key}
              fieldKey={key}
              label={label}
              emoji={emoji}
              values={(profile as any)?.[key] || []}
              editing={editing}
              editValue={editValue}
              saving={saving}
              onEdit={startEdit}
              onCancel={cancelEdit}
              onSave={saveEdit}
              onEditValueChange={setEditValue}
            />
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-border text-slate-400 hover:text-ping-red hover:border-ping-red/30 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Log out</span>
      </button>
    </div>
  );
}

function ProfileSection({
  fieldKey,
  label,
  emoji,
  values,
  editing,
  editValue,
  saving,
  onEdit,
  onCancel,
  onSave,
  onEditValueChange,
}: {
  fieldKey: string;
  label: string;
  emoji: string;
  values: string[];
  editing: string | null;
  editValue: string;
  saving: boolean;
  onEdit: (field: string, values: string[]) => void;
  onCancel: () => void;
  onSave: (field: string) => void;
  onEditValueChange: (value: string) => void;
}) {
  const isEditing = editing === fieldKey;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{emoji}</span>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</span>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSave(fieldKey)}
              disabled={saving}
              className="p-1 rounded text-ping-green hover:bg-ping-green/10 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onCancel}
              className="p-1 rounded text-slate-500 hover:bg-surface-light transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onEdit(fieldKey, values)}
            className="p-1 rounded text-slate-500 hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          placeholder={`One per line...`}
          className="w-full bg-surface-light border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none"
          rows={4}
        />
      ) : values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className="badge bg-surface-light text-slate-300">{v}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">None added yet</p>
      )}
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-medium text-slate-300">{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
