import { Handle, Position } from '@xyflow/react';
import type { ActionNodeData } from '../types';
import { ACTION_LABELS, ACTION_COLORS } from '../types';

export function ActionNode({ data, selected }: { data: ActionNodeData; selected: boolean }) {
  const color = ACTION_COLORS[data.action] ?? '#6b7280';

  return (
    <div style={{
      background: selected ? `${color}22` : `${color}11`,
      border: `1px solid ${selected ? `${color}cc` : `${color}55`}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 160,
      fontFamily: 'var(--font-sans)',
      boxShadow: selected ? `0 0 0 2px ${color}44` : 'none',
      transition: 'all 150ms ease',
    }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color }}>■</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          Action
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
        {data.label || ACTION_LABELS[data.action]}
      </div>

      <div style={{
        marginTop: 6, display: 'inline-block',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        padding: '2px 7px', borderRadius: 4,
        background: `${color}22`, color, border: `1px solid ${color}55`,
        fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
      }}>
        {data.action}
      </div>

      {data.action === 'flair' && data.flairText && (
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
          Flair: "{data.flairText}"
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="next"
        style={{ ...handleStyle, background: color }}
      />
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  background: 'var(--border-strong)',
  border: '2px solid var(--bg-elevated)',
};
