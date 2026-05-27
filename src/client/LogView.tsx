import { useState, useEffect, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
import { ACTION_COLORS, ACTION_LABELS } from './types';
import type { ActionType, LogEntry } from './types';

class LogErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  override render() {
    if (this.state.error) return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <span style={{ color: 'var(--red)' }}>⚠ Log error</span>
        <span>{this.state.error}</span>
      </div>
    );
    return this.props.children;
  }
}

export function LogView() {
  return <LogErrorBoundary><LogViewInner /></LogErrorBoundary>;
}

function LogViewInner() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchLog = useCallback((p: number) => {
    setLoading(true);
    fetch(`/api/modlog?page=${p}`)
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries ?? []);
        setHasMore(d.hasMore ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLog(page);
    if (page !== 0) return;
    const id = setInterval(() => fetchLog(0), 15000);
    return () => clearInterval(id);
  }, [fetchLog, page]);

  const violations = entries.filter(e => e.violation).length;
  const clean = entries.length - violations;
  const actioned = entries.filter(e => e.actions.length > 0).length;

  const actionTypes = [...new Set(entries.flatMap(e => e.actions))] as ActionType[];

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.author.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
    const matchAction =
      filterAction === 'all' ||
      (filterAction === 'none' ? e.actions.length === 0 : e.actions.includes(filterAction));
    return matchSearch && matchAction;
  });

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function fmtDate(ts: number) {
    const d = new Date(ts);
    return d.toDateString() === new Date().toDateString()
      ? 'Today'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '20px', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <StatCard label="Violations" value={violations} color="var(--red)" />
        <StatCard label="Clean" value={clean} color="var(--green)" />
        <StatCard label="Actions Taken" value={actioned} color="var(--accent)" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          className="field"
          style={{ maxWidth: 260, flex: 'none' }}
          placeholder="Search author or content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Chip active={filterAction === 'all'} onClick={() => setFilterAction('all')}>All</Chip>
        {actionTypes.map(a => (
          <Chip key={a} active={filterAction === a} onClick={() => setFilterAction(a)}>
            {ACTION_LABELS[a] ?? a}
          </Chip>
        ))}
        <Chip active={filterAction === 'none'} onClick={() => setFilterAction('none')}>No Action</Chip>
        <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px' }} onClick={() => fetchLog(page)}>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        {loading ? (
          <Empty>Loading...</Empty>
        ) : filtered.length === 0 ? (
          <Empty>
            {entries.length === 0
              ? 'No events yet — they appear here as flows run.'
              : 'No results match your filter.'}
          </Empty>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time', 'Author', 'Content', 'Flow', 'Verdict', 'Action'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    fontFamily: 'var(--font-mono)',
                    position: 'sticky', top: 0,
                    background: 'var(--bg-elevated)',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr
                  key={`${e.ts}-${i}`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtTime(e.ts)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(138,143,152,0.5)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{fmtDate(e.ts)}</div>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>u/{e.author}</span>
                    <span className="tag" style={{ marginLeft: 6, fontSize: 9 }}>{e.contentType}</span>
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 320, verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.preview}>
                      {e.preview || <span style={{ opacity: 0.4 }}>(no content)</span>}
                    </div>
                    {e.reason && (
                      <div style={{ fontSize: 10, color: 'rgba(138,143,152,0.6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.reason}>
                        {e.reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{e.flowName}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: e.violation ? 'var(--red)' : 'var(--green)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: e.violation ? 'var(--red)' : 'var(--green)', boxShadow: e.violation ? '0 0 5px var(--red)' : '0 0 5px var(--green)' }} />
                      {e.violation ? 'Violation' : 'Clean'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                    {e.actions.length > 0
                      ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {e.actions.map((a, i) => <ActionBadge key={i} action={a as ActionType} />)}
                        </div>
                      : <span style={{ fontSize: 11, color: 'rgba(138,143,152,0.35)', fontFamily: 'var(--font-mono)' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: '6px 16px', opacity: page === 0 ? 0.3 : 1 }}
          disabled={page === 0 || loading}
          onClick={() => setPage(p => p - 1)}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
          Page {page + 1}{!hasMore && entries.length < 50 ? '' : ''}
        </span>
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: '6px 16px', opacity: !hasMore ? 0.3 : 1 }}
          disabled={!hasMore || loading}
          onClick={() => setPage(p => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', border: '1px solid',
        borderColor: active ? 'rgba(255,69,0,0.45)' : 'var(--border)',
        background: active ? 'rgba(255,69,0,0.1)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-muted)',
        transition: 'all 140ms',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function ActionBadge({ action }: { action: ActionType }) {
  const color = ACTION_COLORS[action] ?? '#8a8f98';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      color, background: `${color}18`, border: `1px solid ${color}40`,
      fontFamily: 'var(--font-mono)',
    }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>{children}</div>
  );
}
