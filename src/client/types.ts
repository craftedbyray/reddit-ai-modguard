export type ActionType =
  | 'remove'
  | 'spam'
  | 'filter'
  | 'lock'
  | 'approve'
  | 'flair'
  | 'warn'
  | 'ban'
  | 'mute'
  | 'strike';

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
  strike:  'Strike (+1)',
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
  strike:  '#ec4899',
};

export type CheckMode = 'llm' | 'strike';
export type CompareOp = '>=' | '>' | '<=' | '<' | '==';

export const STRIKE_LABEL_REGEX = /^[a-z0-9_-]{1,30}$/;

// ── Node data types ─────────────────────────────────────────
export interface CheckNodeData {
  label: string;
  mode?: CheckMode;           // default 'llm'
  prompt?: string;            // for 'llm' mode
  strikeLabel?: string;       // for 'strike' mode
  threshold?: number;         // for 'strike' mode
  operator?: CompareOp;       // for 'strike' mode
}

export interface ActionNodeData {
  action: ActionType;
  label: string;
  flairText?: string;    // for 'flair' action
  warnMessage?: string;  // for 'warn' action
  banDuration?: number;  // for 'ban': days, 0 = permanent
  strikeLabel?: string;  // for 'strike' action
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
  sourceHandle: 'yes' | 'no' | 'next';
  target: string;
}

// ── Audit log entry ─────────────────────────────────────────
export interface LogEntry {
  _id: string;
  ts: number;
  author: string;
  preview: string;
  flowId: string;
  flowName: string;
  violation: boolean;
  reason: string;
  action: string | null;
  contentType: 'post' | 'comment';
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
