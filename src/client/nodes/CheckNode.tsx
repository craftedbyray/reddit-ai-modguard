import { Handle, Position } from '@xyflow/react';
import type { CheckNodeData } from '../types';

export function CheckNode({ data, selected }: { data: CheckNodeData; selected: boolean }) {
  return (
    <div style={{
      background: selected ? 'rgba(234,179,8,0.18)' : 'rgba(234,179,8,0.08)',
      border: `1px solid ${selected ? 'rgba(234,179,8,0.8)' : 'rgba(234,179,8,0.35)'}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 200,
      maxWidth: 260,
      fontFamily: 'var(--font-sans)',
      boxShadow: selected ? '0 0 0 2px rgba(234,179,8,0.3)' : 'none',
      transition: 'all 150ms ease',
    }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#fbbf24' }}>●</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          Check
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
        {data.label || 'Untitled Check'}
      </div>

      {data.prompt && (
        <div style={{
          fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {data.prompt}
        </div>
      )}

      {/* Yes handle (left-bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ ...handleStyle, left: '30%', background: '#10b981' }}
      />
      {/* No handle (right-bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ ...handleStyle, left: '70%', background: '#ef4444' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 10, color: '#10b981', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>◀ YES</span>
        <span style={{ fontSize: 10, color: '#ef4444', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>NO ▶</span>
      </div>
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  background: 'var(--border-strong)',
  border: '2px solid var(--bg-elevated)',
};
