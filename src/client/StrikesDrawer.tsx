import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { STRIKE_LABEL_REGEX } from './types';

interface LabelInfo { name: string; userCount: number; }
interface RankRow { username: string; score: number; }

export function StrikesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [labels, setLabels] = useState<LabelInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshLabels = useCallback(async () => {
    setLoadingLabels(true);
    try {
      const res = await fetch('/api/strikes/labels');
      const data = await res.json();
      setLabels(data.labels ?? []);
    } catch { /* ignore */ }
    finally { setLoadingLabels(false); }
  }, []);

  const refreshRanking = useCallback(async (label: string) => {
    setLoadingRanking(true);
    try {
      const res = await fetch(`/api/strikes/${encodeURIComponent(label)}/ranking`);
      const data = await res.json();
      setRanking(data.ranking ?? []);
    } catch { /* ignore */ }
    finally { setLoadingRanking(false); }
  }, []);

  useEffect(() => {
    if (open) { void refreshLabels(); }
  }, [open, refreshLabels]);

  useEffect(() => {
    if (selected) { void refreshRanking(selected); }
    else setRanking([]);
  }, [selected, refreshRanking]);

  const newLabelValid = STRIKE_LABEL_REGEX.test(newLabel);
  async function createLabel() {
    if (!newLabelValid) return;
    setError(null);
    try {
      const res = await fetch('/api/strikes/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabel }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? 'Failed'); return; }
      setNewLabel('');
      await refreshLabels();
    } catch (e) { setError(String(e)); }
  }

  async function deleteLabel(name: string) {
    if (pendingDeleteLabel !== name) {
      setPendingDeleteLabel(name);
      setTimeout(() => setPendingDeleteLabel(curr => curr === name ? null : curr), 4000);
      return;
    }
    setPendingDeleteLabel(null);
    await fetch(`/api/strikes/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (selected === name) setSelected(null);
    await refreshLabels();
  }

  async function resetUser(label: string, username: string) {
    await fetch(`/api/strikes/${encodeURIComponent(label)}/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    await refreshRanking(label);
    await refreshLabels();
  }

  const maxScore = ranking.reduce((m, r) => Math.max(m, r.score), 1);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: open ? 'rgba(0,0,0,0.4)' : 'transparent',
          backdropFilter: open ? 'blur(2px)' : 'none',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'all 220ms ease',
          zIndex: 50,
        }}
      />

      {/* Drawer */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 360,
        background: 'rgba(12,12,14,0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-strong)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        zIndex: 60,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: '#ec4899', boxShadow: '0 0 10px #ec4899',
            }} />
            <h2 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--fg)',
            }}>Strikes</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close" style={{ padding: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>✕</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* New label */}
          <section>
            <p style={sectionHeading}>+ New Label</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="field"
                value={newLabel}
                placeholder="a-z, 0-9, _, -"
                style={{ flex: 1 }}
                onChange={e => setNewLabel(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                onKeyDown={e => e.key === 'Enter' && createLabel()}
              />
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '0 14px', opacity: newLabelValid ? 1 : 0.4 }}
                disabled={!newLabelValid}
                onClick={createLabel}
              >Add</button>
            </div>
            {newLabel && !newLabelValid && (
              <p style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>
                Use a-z, 0-9, _ or -, max 30 chars
              </p>
            )}
            {error && (
              <p style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>{error}</p>
            )}
          </section>

          {/* Labels list */}
          <section>
            <p style={sectionHeading}>Labels {loadingLabels && <span style={{ color: 'var(--fg-muted)' }}>· loading…</span>}</p>
            {labels.length === 0 && !loadingLabels && (
              <p style={{ fontSize: 11, color: 'var(--fg-muted)' }}>No labels yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {labels.map(l => {
                const isPendingDelete = pendingDeleteLabel === l.name;
                const isSelected = selected === l.name;
                return (
                  <div
                    key={l.name}
                    onClick={() => !isPendingDelete && setSelected(l.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 6,
                      cursor: isPendingDelete ? 'default' : 'pointer',
                      background: isPendingDelete
                        ? 'rgba(239,68,68,0.12)'
                        : isSelected
                          ? 'rgba(236,72,153,0.12)'
                          : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isPendingDelete ? '#ef4444' : isSelected ? 'rgba(236,72,153,0.4)' : 'transparent'}`,
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#ec4899' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', flex: 1 }}>
                      {l.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                      {l.userCount}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); void deleteLabel(l.name); }}
                      className="icon-btn del"
                      style={{ padding: 4 }}
                      title={isPendingDelete ? 'Click again to confirm' : 'Delete label'}
                    >
                      {isPendingDelete
                        ? <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>✓?</span>
                        : <span style={{ fontSize: 11 }}>✕</span>
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Ranking */}
          {selected && (
            <section>
              <p style={sectionHeading}>
                Ranking · <span style={{ color: '#ec4899', fontFamily: 'var(--font-mono)' }}>{selected}</span>
                {loadingRanking && <span style={{ color: 'var(--fg-muted)' }}> · loading…</span>}
              </p>
              {ranking.length === 0 && !loadingRanking && (
                <p style={{ fontSize: 11, color: 'var(--fg-muted)' }}>No strikes recorded yet.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {ranking.map((row, i) => (
                  <div key={row.username} style={{
                    position: 'relative',
                    padding: '7px 10px',
                    borderRadius: 5,
                    background: 'rgba(255,255,255,0.025)',
                    overflow: 'hidden',
                  }}>
                    {/* score bar */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      width: `${(row.score / maxScore) * 100}%`,
                      background: 'linear-gradient(90deg, rgba(236,72,153,0.22), rgba(236,72,153,0.04))',
                      transition: 'width 240ms ease',
                    }} />
                    {/* content */}
                    <div style={{
                      position: 'relative',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: i < 3 ? '#ec4899' : 'var(--fg-muted)',
                        fontWeight: 700, width: 20,
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--fg)', flex: 1 }}>
                        u/{row.username}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                        color: '#ec4899', minWidth: 28, textAlign: 'right',
                      }}>
                        {row.score}
                      </span>
                      <button
                        className="icon-btn"
                        style={{ padding: 3, opacity: 0.6 }}
                        title="Reset this user"
                        onClick={() => resetUser(selected, row.username)}
                      >
                        <span style={{ fontSize: 11 }}>⟲</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.5,
        }}>
          Use a strike label in a flow's Strike action to start counting.
          Reset users or delete labels here.
        </div>
      </aside>
    </>
  );
}

const sectionHeading: CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: 'var(--font-mono)',
  marginBottom: 8,
};
