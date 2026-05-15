import { useState, useEffect, useCallback } from 'react';
import { FlowEditor } from './FlowEditor';
import type { ModerationFlow, RFNode, ActionType, ScopeType } from './types';
import { ACTION_LABELS, ACTION_COLORS } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStarterFlow(name: string, scope: ScopeType): ModerationFlow {
  const checkId = `check-${Date.now()}`;
  const actionId = `action-${Date.now() + 1}`;
  return {
    id: Date.now().toString(),
    name,
    scope,
    isActive: true,
    nodes: [
      { id: checkId,  type: 'check',  position: { x: 100, y: 60 },  data: { label: 'Is this a violation?', prompt: '' } },
      { id: actionId, type: 'action', position: { x: 60,  y: 230 }, data: { action: 'remove', label: 'Remove' } },
    ],
    edges: [
      { id: `e-${checkId}-yes-${actionId}`, source: checkId, sourceHandle: 'yes', target: actionId },
    ],
  };
}

// ── Node edit panel ───────────────────────────────────────────────────────────

function NodePanel({
  flow,
  nodeId,
  onUpdate,
}: {
  flow: ModerationFlow;
  nodeId: string;
  onUpdate: (updatedFlow: ModerationFlow) => void;
}) {
  const node = flow.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  function updateNodeData(patch: Record<string, unknown>) {
    const updatedNodes = flow.nodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
    );
    onUpdate({ ...flow, nodes: updatedNodes });
  }

  const data = node.data as any;

  return (
    <div style={{
      width: 260, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.02)',
      padding: 18,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
        {node.type === 'check' ? '● Check Node' : '■ Action Node'}
      </p>

      <FormField label="Label">
        <input
          className="field"
          value={data.label ?? ''}
          placeholder="Short description"
          onChange={e => updateNodeData({ label: e.target.value })}
        />
      </FormField>

      {node.type === 'check' && (
        <FormField label="Prompt">
          <textarea
            className="field"
            value={data.prompt ?? ''}
            placeholder="Describe what to detect…"
            onChange={e => updateNodeData({ prompt: e.target.value })}
            style={{ minHeight: 120 }}
          />
        </FormField>
      )}

      {node.type === 'action' && (
        <>
          <FormField label="Action">
            <select
              className="field"
              value={data.action ?? 'remove'}
              onChange={e => {
                const action = e.target.value as ActionType;
                updateNodeData({ action, label: ACTION_LABELS[action] });
              }}
            >
              {(Object.keys(ACTION_LABELS) as ActionType[]).map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </FormField>

          {data.action === 'flair' && (
            <FormField label="Flair Text">
              <input
                className="field"
                value={data.flairText ?? ''}
                placeholder="e.g. ⚠️ AI Flagged"
                onChange={e => updateNodeData({ flairText: e.target.value })}
              />
            </FormField>
          )}

          {data.action === 'warn' && (
            <FormField label="Modmail Message">
              <textarea
                className="field"
                value={data.warnMessage ?? ''}
                placeholder="Message to include in modmail…"
                onChange={e => updateNodeData({ warnMessage: e.target.value })}
                style={{ minHeight: 80 }}
              />
            </FormField>
          )}

          {data.action === 'ban' && (
            <FormField label="Ban Duration (days, 0 = permanent)">
              <input
                className="field"
                type="number"
                min={0}
                value={data.banDuration ?? 0}
                onChange={e => updateNodeData({ banDuration: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          )}
        </>
      )}

      <p style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 'auto', lineHeight: 1.6 }}>
        {node.type === 'check'
          ? 'Drag the green handle to connect Yes, red handle for No.'
          : 'Action nodes are sinks — connect edges from check nodes.'}
      </p>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

export default function App() {
  const [flows, setFlows] = useState<ModerationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<ScopeType>('both');

  useEffect(() => {
    fetch('/api/flows')
      .then(r => r.json())
      .then(d => setFlows(d.flows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function persist(list: ModerationFlow[]) {
    setSaving(true);
    try {
      await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flows: list }),
      });
      setFlows(list);
    } finally {
      setSaving(false);
    }
  }

  function createFlow() {
    if (!newName.trim()) return;
    const flow = makeStarterFlow(newName.trim(), newScope);
    const updated = [...flows, flow];
    persist(updated);
    setSelectedFlowId(flow.id);
    setSelectedNodeId(null);
    setShowNewForm(false);
    setNewName('');
    setNewScope('both');
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  function deleteFlow(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setTimeout(() => setPendingDeleteId(curr => curr === id ? null : curr), 4000);
      return;
    }
    setPendingDeleteId(null);
    const updated = flows.filter(f => f.id !== id);
    persist(updated);
    if (selectedFlowId === id) {
      setSelectedFlowId(null);
      setSelectedNodeId(null);
    }
  }

  function toggleFlow(id: string) {
    persist(flows.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f));
  }

  const updateFlow = useCallback((updated: ModerationFlow) => {
    setFlows(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  function saveFlow() {
    persist(flows);
  }

  const selectedFlow = flows.find(f => f.id === selectedFlowId) ?? null;
  const activeCount = flows.filter(f => f.isActive).length;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'rgba(5,5,6,0.85)', backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              AI Mod Guardian
            </h1>
            <p style={{ color: 'var(--fg-muted)', fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              Visual moderation flow builder
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saving && <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>saving…</span>}
            {selectedFlow && (
              <button className="btn-primary" style={{ flex: 'none', padding: '8px 16px', fontSize: 12 }} onClick={saveFlow} disabled={saving}>
                Save Flow
              </button>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              fontSize: 12, fontWeight: 600,
              color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
            }}>
              <span className={`dot${activeCount === 0 ? ' dot-off' : ''}`} style={{ width: 6, height: 6 }} />
              {activeCount} active
            </div>
          </div>
        </header>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Sidebar */}
          <div style={{
            width: 230, flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'rgba(5,5,6,0.6)',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <button
                className="btn-primary"
                style={{ width: '100%', flex: 'none', fontSize: 12, padding: '8px 0' }}
                onClick={() => setShowNewForm(v => !v)}
              >
                {showNewForm ? 'Cancel' : '+ New Flow'}
              </button>

              {showNewForm && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="field"
                    placeholder="Flow name…"
                    value={newName}
                    autoFocus
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createFlow()}
                  />
                  <div className="seg">
                    {(['post', 'comment', 'both'] as ScopeType[]).map(s => (
                      <button key={s} className={`seg-btn${newScope === s ? ' active' : ''}`} onClick={() => setNewScope(s)}>
                        {s === 'post' ? 'Posts' : s === 'comment' ? 'Comments' : 'Both'}
                      </button>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ fontSize: 12 }} disabled={!newName.trim()} onClick={createFlow}>
                    Create
                  </button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, padding: '8px 0' }}>
              {loading && (
                <p style={{ padding: '20px 14px', color: 'var(--fg-muted)', fontSize: 12 }}>Loading…</p>
              )}
              {!loading && flows.length === 0 && (
                <p style={{ padding: '20px 14px', color: 'var(--fg-muted)', fontSize: 12 }}>No flows yet. Create one above.</p>
              )}
              {flows.map(flow => (
                <FlowListItem
                  key={flow.id}
                  flow={flow}
                  isSelected={flow.id === selectedFlowId}
                  pendingDelete={pendingDeleteId === flow.id}
                  onSelect={() => { setSelectedFlowId(flow.id); setSelectedNodeId(null); }}
                  onToggle={() => toggleFlow(flow.id)}
                  onDelete={() => deleteFlow(flow.id)}
                  onCancelDelete={() => setPendingDeleteId(null)}
                />
              ))}
            </div>
          </div>

          {/* Canvas area */}
          {selectedFlow ? (
            <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FlowEditor
                  key={selectedFlow.id}
                  flow={selectedFlow}
                  onFlowChange={updateFlow}
                  onNodeSelect={setSelectedNodeId}
                  selectedNodeId={selectedNodeId}
                />
              </div>
              {selectedNodeId && (
                <NodePanel
                  flow={selectedFlow}
                  nodeId={selectedNodeId}
                  onUpdate={updateFlow}
                />
              )}
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}>
              <p style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 16 }}>No flow selected</p>
              <p style={{ color: 'var(--fg-muted)', fontSize: 13 }}>
                {flows.length === 0 ? 'Create your first moderation flow on the left.' : 'Select a flow from the sidebar.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlowListItem({
  flow, isSelected, pendingDelete, onSelect, onToggle, onDelete, onCancelDelete,
}: {
  flow: ModerationFlow;
  isSelected: boolean;
  pendingDelete: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  const checkCount = flow.nodes.filter(n => n.type === 'check').length;
  const actionCount = flow.nodes.filter(n => n.type === 'action').length;

  // Get unique action colors for the flow
  const actionColors = [...new Set(
    flow.nodes.filter(n => n.type === 'action').map(n => ACTION_COLORS[(n.data as any).action])
  )].slice(0, 3);

  if (pendingDelete) {
    return (
      <div style={{
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.12)',
        borderLeft: '2px solid #ef4444',
      }}>
        <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8, lineHeight: 1.4 }}>
          Delete <strong style={{ color: '#fff' }}>"{flow.name}"</strong>?
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-primary"
            style={{
              fontSize: 11, padding: '5px 10px', flex: 1,
              background: '#ef4444', borderColor: '#ef4444',
            }}
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '5px 10px', flex: 1 }}
            onClick={onCancelDelete}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 14px',
        cursor: 'pointer',
        background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
        borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
        transition: 'all 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{flow.name}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="icon-btn"
            style={{ padding: 4 }}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            title={flow.isActive ? 'Pause' : 'Activate'}
          >
            <span className={`dot${flow.isActive ? '' : ' dot-off'}`} style={{ width: 6, height: 6 }} />
          </button>
          <button
            className="icon-btn del"
            style={{ padding: 4 }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
          {checkCount} checks · {actionCount} actions
        </span>
        {actionColors.map((c, i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
        ))}
      </div>

      <div style={{ marginTop: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
          padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)',
        }}>
          {flow.scope}
        </span>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
