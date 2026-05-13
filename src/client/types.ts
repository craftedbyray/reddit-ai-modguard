export type ActionType =
  | 'remove'
  | 'spam'
  | 'filter'
  | 'lock'
  | 'approve'
  | 'flair'
  | 'warn'
  | 'ban'
  | 'mute';

export type ScopeType = 'post' | 'comment' | 'both';

export const ACTION_LABELS: Record<ActionType, string> = {
  remove:  'Remove',
  spam:    'Mark as Spam',
  filter:  'Send to ModQueue',
  lock:    'Lock',
  approve: 'Approve',
  flair:   'Set Flair',
  warn:    'Warn (Modmail)',
  ban:     'Ban User',
  mute:    'Mute User',
};

export const ACTION_COLORS: Record<ActionType, string> = {
  remove:  '#ef4444',
  spam:    '#f97316',
  filter:  '#eab308',
  lock:    '#8b5cf6',
  approve: '#10b981',
  flair:   '#3b82f6',
  warn:    '#f59e0b',
  ban:     '#dc2626',
  mute:    '#6b7280',
};

// ── Node data types ─────────────────────────────────────────
export interface CheckNodeData {
  label: string;
  prompt: string;
}

export interface ActionNodeData {
  action: ActionType;
  label: string;
  flairText?: string;    // for 'flair' action
  warnMessage?: string;  // for 'warn' action
  banDuration?: number;  // for 'ban': days, 0 = permanent
}

// ── React Flow compatible node ───────────────────────────────
export interface RFNode {
  id: string;
  type: 'check' | 'action';
  position: { x: number; y: number };
  data: CheckNodeData | ActionNodeData;
}

export interface RFEdge {
  id: string;
  source: string;
  sourceHandle: 'yes' | 'no';
  target: string;
}

// ── Top-level flow (replaces Agent) ─────────────────────────
export interface ModerationFlow {
  id: string;
  name: string;
  scope: ScopeType;
  isActive: boolean;
  nodes: RFNode[];
  edges: RFEdge[];
}
