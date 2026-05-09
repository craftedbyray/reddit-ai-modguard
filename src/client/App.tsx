import { useState, useEffect } from 'react';

type ActionType = 'remove' | 'lock' | 'warn';
type ScopeType  = 'post' | 'comment' | 'both';

interface Agent {
  id: string;
  name: string;
  prompt: string;
  action: ActionType;
  scope: ScopeType;
  isActive: boolean;
}

const ACTION_LABELS: Record<ActionType, string> = {
  remove: 'Remove',
  lock:   'Lock',
  warn:   'Warn',
};

export default function App() {
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name,   setName]   = useState('');
  const [prompt, setPrompt] = useState('');
  const [action, setAction] = useState<ActionType>('remove');
  const [scope,  setScope]  = useState<ScopeType>('both');

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAgents(d.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function persist(list: Agent[]) {
    setSaving(true);
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: list }),
      });
      setAgents(list);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setEditingId(null);
    setName(''); setPrompt(''); setAction('remove'); setScope('both');
  }

  function startEdit(a: Agent) {
    setEditingId(a.id);
    setName(a.name); setPrompt(a.prompt); setAction(a.action); setScope(a.scope ?? 'both');
  }

  function submit() {
    if (!name.trim() || !prompt.trim() || saving) return;
    const agent: Agent = {
      id: editingId ?? Date.now().toString(),
      name: name.trim(), prompt: prompt.trim(), action, scope, isActive: true,
    };
    persist(
      editingId
        ? agents.map(a => (a.id === editingId ? agent : a))
        : [...agents, agent]
    );
    reset();
  }

  const activeCount = agents.filter(a => a.isActive).length;
  const valid = name.trim().length > 0 && prompt.trim().length > 0;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '24px', zIndex: 1 }}>
      {/* Ambient blobs */}
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--fg)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              AI Mod Guardian
            </h1>
            <p style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 4, fontFamily: 'var(--font-sans)' }}>
              Autonomous LLM agents enforcing your community rules
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saving && (
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                syncing…
              </span>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 13px', borderRadius: 999,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              fontSize: 12, fontWeight: 600,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              <span className="dot" style={activeCount === 0 ? { background: 'var(--fg-muted)', boxShadow: 'none' } : {}} />
              {activeCount} active
            </div>
          </div>
        </header>

        {/* Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

          {/* ── Left: Form ── */}
          <div className="glass" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 18, fontFamily: 'var(--font-sans)' }}>
              {editingId ? '✎ Edit Agent' : '+ Deploy Agent'}
            </p>

            <FormField label="Agent Name">
              <input
                className="field"
                placeholder="e.g. Toxicity Filter"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </FormField>

            <FormField label="Rule Prompt">
              <textarea
                className="field"
                placeholder="Describe what this agent should detect and why it violates your rules…"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </FormField>

            <FormField label="Scope">
              <div className="seg">
                {(['post', 'comment', 'both'] as ScopeType[]).map(s => (
                  <button
                    key={s}
                    className={`seg-btn${scope === s ? ' active' : ''}`}
                    onClick={() => setScope(s)}
                  >
                    {s === 'post' ? 'Posts' : s === 'comment' ? 'Comments' : 'Both'}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Action">
              <div className="seg">
                {(['remove', 'lock', 'warn'] as ActionType[]).map(a => (
                  <button
                    key={a}
                    className={`seg-btn${action === a ? ' active' : ''}`}
                    onClick={() => setAction(a)}
                  >
                    {ACTION_LABELS[a]}
                  </button>
                ))}
              </div>
            </FormField>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn-primary" disabled={!valid || saving} onClick={submit}>
                {editingId ? 'Update Agent' : 'Deploy Agent'}
              </button>
              {editingId && (
                <button className="btn-ghost" onClick={reset}>Cancel</button>
              )}
            </div>
          </div>

          {/* ── Right: Agent list ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}>
                Active Forces
              </p>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                {agents.length} total
              </p>
            </div>

            {loading && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                Loading agents…
              </div>
            )}

            {!loading && agents.length === 0 && (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
              }}>
                <p style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 14 }}>No agents deployed</p>
                <p style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 6 }}>
                  Create your first AI moderator on the left.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={() => persist(agents.map(a => a.id === agent.id ? { ...a, isActive: !a.isActive } : a))}
                  onEdit={() => startEdit(agent)}
                  onDelete={() => {
                    if (confirm(`Delete "${agent.name}"?`))
                      persist(agents.filter(a => a.id !== agent.id));
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--fg-muted)', marginBottom: 6,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function AgentCard({
  agent, onToggle, onEdit, onDelete,
}: {
  agent: Agent;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`agent-card ${agent.isActive ? 'active-card' : 'paused-card'}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>

        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}>
              {agent.name}
            </span>
            <span className={`tag tag-action-${agent.action}`}>{agent.action}</span>
            <span className="tag tag-scope">{agent.scope ?? 'both'}</span>
          </div>
          <p style={{
            fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.55,
            fontFamily: 'var(--font-sans)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {agent.prompt}
          </p>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            className={`pill ${agent.isActive ? 'pill-active' : 'pill-paused'}`}
            onClick={onToggle}
          >
            <span className={`dot${agent.isActive ? '' : ' dot-off'}`} style={{ width: 5, height: 5 }} />
            {agent.isActive ? 'Active' : 'Paused'}
          </button>

          <button className="icon-btn edit" onClick={onEdit} title="Edit">
            <EditIcon />
          </button>
          <button className="icon-btn del" onClick={onDelete} title="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
