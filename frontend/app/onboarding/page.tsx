'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Zap, Plus, X } from 'lucide-react';
import { profileApi } from '@/lib/api';

const TOTAL_STEPS = 4;

const EXPERTISE_SUGGESTIONS = [
  'Software Engineering', 'AI / ML', 'Product Design', 'Data Science',
  'Marketing', 'Finance', 'Startups', 'Mobile Dev', 'DevOps',
  'Blockchain', 'Healthcare', 'Education', 'Real Estate', 'Law',
  'Music', 'Photography', 'Writing', 'Sales', 'Management', 'Research',
];

const STYLE_OPTIONS = [
  { value: 'concise', label: 'Concise', desc: 'Short and to the point' },
  { value: 'balanced', label: 'Balanced', desc: 'Mix of detail and brevity' },
  { value: 'detailed', label: 'Detailed', desc: 'Thorough and comprehensive' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: What you know
  const [agentName, setAgentName] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [customExpertise, setCustomExpertise] = useState('');
  const [experiences, setExperiences] = useState<string[]>(['']);
  const [opinions, setOpinions] = useState<string[]>(['']);

  // Step 2: What you're looking for
  const [activeQuestions, setActiveQuestions] = useState<string[]>(['']);
  const [goals, setGoals] = useState<string[]>(['']);
  const [decisions, setDecisions] = useState<string[]>(['']);

  // Step 3: Where you're based
  const [localKnowledge, setLocalKnowledge] = useState<string[]>(['']);

  // Step 4: Agent behavior
  const [conversationStyle, setConversationStyle] = useState('balanced');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.name) setAgentName(`${user.name}'s Agent`);
      } catch {}
    }
  }, [router]);

  const toggleExpertise = (item: string) => {
    setExpertise((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const addCustomExpertise = () => {
    if (customExpertise.trim() && !expertise.includes(customExpertise.trim())) {
      setExpertise([...expertise, customExpertise.trim()]);
      setCustomExpertise('');
    }
  };

  const updateList = (setter: (val: string[]) => void, list: string[], idx: number, val: string) => {
    const updated = [...list];
    updated[idx] = val;
    setter(updated);
  };

  const addToList = (setter: (val: string[]) => void, list: string[], max: number) => {
    if (list.length < max) setter([...list, '']);
  };

  const removeFromList = (setter: (val: string[]) => void, list: string[], idx: number) => {
    if (list.length > 1) setter(list.filter((_, i) => i !== idx));
  };

  const clean = (arr: string[]) => arr.filter((s) => s.trim().length > 0);

  const canAdvance = () => {
    switch (step) {
      case 1: return agentName.trim().length > 0 && expertise.length >= 1;
      case 2: return activeQuestions.some((q) => q.trim().length > 0) || goals.some((g) => g.trim().length > 0);
      case 3: return true; // optional
      case 4: return true;
      default: return false;
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await profileApi.onboard({
        agentName: agentName.trim(),
        expertise,
        experiences: clean(experiences),
        opinions: clean(opinions),
        activeQuestions: clean(activeQuestions),
        goals: clean(goals),
        decisions: clean(decisions),
        localKnowledge: clean(localKnowledge),
        conversationStyle,
      });
      localStorage.setItem('ping_onboarded', 'true');
      router.push('/chat');
    } catch (err: any) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const ListInput = ({
    items, setItems, placeholder, max,
  }: {
    items: string[]; setItems: (v: string[]) => void; placeholder: string; max: number;
  }) => (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateList(setItems, items, idx, e.target.value)}
            placeholder={`${placeholder} ${idx + 1}`}
            className="input-field flex-1"
          />
          {items.length > 1 && (
            <button onClick={() => removeFromList(setItems, items, idx)} className="p-3 text-slate-500 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {items.length < max && (
        <button onClick={() => addToList(setItems, items, max)} className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-light">
          <Plus className="w-4 h-4" /> Add more
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Step {step} of {TOTAL_STEPS}</span>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          )}
        </div>
        <div className="w-full h-1 bg-surface-border rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {/* Step 1: What you know */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-100 mb-1">What do you know?</h2>
            <p className="text-sm text-slate-500 mb-6">Tell your agent what you&apos;re good at. This is your supply signal — how you help others.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent name</label>
                <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Your Agent" className="input-field" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Expertise areas <span className="text-accent">({expertise.length} selected)</span></label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {EXPERTISE_SUGGESTIONS.map((item) => {
                    const selected = expertise.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => toggleExpertise(item)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selected ? 'bg-accent text-white' : 'bg-surface-light border border-surface-border text-slate-300 hover:border-accent/40'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customExpertise}
                    onChange={(e) => setCustomExpertise(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomExpertise()}
                    placeholder="Add custom..."
                    className="input-field flex-1"
                  />
                  <button onClick={addCustomExpertise} className="btn-secondary px-3">Add</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Experiences (optional)</label>
                <ListInput items={experiences} setItems={setExperiences} placeholder="Experience" max={5} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Strong opinions (optional)</label>
                <ListInput items={opinions} setItems={setOpinions} placeholder="Opinion" max={5} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: What you're looking for */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-100 mb-1">What are you looking for?</h2>
            <p className="text-sm text-slate-500 mb-6">This is your demand signal — what the network should find for you.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Questions you want answered</label>
                <ListInput items={activeQuestions} setItems={setActiveQuestions} placeholder="Question" max={5} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Current goals</label>
                <ListInput items={goals} setItems={setGoals} placeholder="Goal" max={3} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Decisions you&apos;re making (optional)</label>
                <ListInput items={decisions} setItems={setDecisions} placeholder="Decision" max={3} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Where you're based */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Where are you based?</h2>
            <p className="text-sm text-slate-500 mb-6">Local knowledge helps with location-specific questions. Skip if not relevant.</p>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Places you know well</label>
              <ListInput items={localKnowledge} setItems={setLocalKnowledge} placeholder="City or region" max={5} />
            </div>
          </div>
        )}

        {/* Step 4: Agent behavior */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-100 mb-1">How should your agent talk?</h2>
            <p className="text-sm text-slate-500 mb-6">This affects how your agent communicates in the network.</p>

            <div className="space-y-3">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setConversationStyle(style.value)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    conversationStyle === style.value
                      ? 'bg-accent/10 border-accent text-slate-100'
                      : 'bg-surface border-surface-border text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-semibold text-sm">{style.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-6 py-4 border-t border-surface-border bg-slate-900/80 backdrop-blur">
        {step < TOTAL_STEPS ? (
          <div className="flex gap-3">
            {step === 3 && (
              <button onClick={() => setStep(4)} className="btn-secondary flex-1">Skip</button>
            )}
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={handleComplete} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <Zap className="w-4 h-4" /> {saving ? 'Setting up...' : 'Launch My Agent'}
          </button>
        )}
      </div>
    </div>
  );
}
