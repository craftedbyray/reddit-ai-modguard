import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CheckNode } from './nodes/CheckNode';
import { ActionNode } from './nodes/ActionNode';
import type { ModerationFlow, RFNode, RFEdge, ActionType } from './types';
import { ACTION_LABELS } from './types';

const nodeTypes = {
  check: CheckNode as any,
  action: ActionNode as any,
};

function toRFNodes(nodes: RFNode[]): Node[] {
  return nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data, selected: false }));
}

function toRFEdges(edges: RFEdge[]): Edge[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    label: e.sourceHandle === 'yes' ? 'Yes' : 'No',
    labelStyle: { fill: e.sourceHandle === 'yes' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 11 },
    labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.9 },
    style: { stroke: e.sourceHandle === 'yes' ? '#10b981' : '#ef4444', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: e.sourceHandle === 'yes' ? '#10b981' : '#ef4444' },
    animated: false,
  }));
}

interface FlowEditorProps {
  flow: ModerationFlow;
  onFlowChange: (updated: ModerationFlow) => void;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

export function FlowEditor({ flow, onFlowChange, onNodeSelect, selectedNodeId }: FlowEditorProps) {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState(toRFNodes(flow.nodes));
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState(toRFEdges(flow.edges));

  // Sync RF state → flow when nodes/edges change position
  const syncToFlow = useCallback((nodes: Node[], edges: Edge[]) => {
    const updatedNodes: RFNode[] = nodes.map(n => ({
      id: n.id,
      type: n.type as 'check' | 'action',
      position: n.position,
      data: n.data as any,
    }));
    const updatedEdges: RFEdge[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: (e.sourceHandle ?? 'yes') as 'yes' | 'no',
      target: e.target,
    }));
    onFlowChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
  }, [flow, onFlowChange]);

  const onConnect = useCallback((params: Connection) => {
    // Only allow one edge per sourceHandle
    const existingEdge = rfEdges.find(
      e => e.source === params.source && e.sourceHandle === params.sourceHandle
    );
    if (existingEdge) return; // already connected

    const handle = (params.sourceHandle ?? 'yes') as 'yes' | 'no';
    const newEdge: Edge = {
      id: `e-${params.source}-${handle}-${params.target}`,
      source: params.source!,
      sourceHandle: handle,
      target: params.target!,
      label: handle === 'yes' ? 'Yes' : 'No',
      labelStyle: { fill: handle === 'yes' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.9 },
      style: { stroke: handle === 'yes' ? '#10b981' : '#ef4444', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: handle === 'yes' ? '#10b981' : '#ef4444' },
    };
    const updated = addEdge(newEdge, rfEdges);
    setRFEdges(updated);
    syncToFlow(rfNodes, updated);
  }, [rfEdges, rfNodes, setRFEdges, syncToFlow]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeSelect(node.id);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Track node drag end to persist positions
  const onNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, nodes: Node[]) => {
    syncToFlow(nodes, rfEdges);
  }, [rfEdges, syncToFlow]);

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const remaining = rfEdges.filter(e => !deleted.find(d => d.id === e.id));
    syncToFlow(rfNodes, remaining);
  }, [rfEdges, rfNodes, syncToFlow]);

  // Add new check node
  function addCheckNode() {
    const id = `check-${Date.now()}`;
    const node: Node = {
      id, type: 'check',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 200 },
      data: { label: 'New Check', prompt: '' },
    };
    const updated = [...rfNodes, node];
    setRFNodes(updated);
    syncToFlow(updated, rfEdges);
    onNodeSelect(id);
  }

  // Add new action node
  function addActionNode(action: ActionType) {
    const id = `action-${Date.now()}`;
    const node: Node = {
      id, type: 'action',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 300 },
      data: { action, label: ACTION_LABELS[action] },
    };
    const updated = [...rfNodes, node];
    setRFNodes(updated);
    syncToFlow(updated, rfEdges);
  }

  // Delete selected node
  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    const updatedNodes = rfNodes.filter(n => n.id !== selectedNodeId);
    const updatedEdges = rfEdges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setRFNodes(updatedNodes);
    setRFEdges(updatedEdges);
    syncToFlow(updatedNodes, updatedEdges);
    onNodeSelect(null);
  }

  const actionOptions: ActionType[] = ['remove', 'spam', 'filter', 'lock', 'approve', 'flair', 'warn', 'ban', 'mute'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.02)',
        flexWrap: 'wrap',
      }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={addCheckNode}>
          + Check Node
        </button>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <select
            className="field"
            style={{ fontSize: 12, padding: '6px 12px', width: 'auto', cursor: 'pointer' }}
            defaultValue=""
            onChange={e => { if (e.target.value) { addActionNode(e.target.value as ActionType); e.target.value = ''; } }}
          >
            <option value="" disabled>+ Action Node…</option>
            {actionOptions.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {selectedNodeId && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '6px 12px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)', marginLeft: 'auto' }}
            onClick={deleteSelectedNode}
          >
            Delete Node
          </button>
        )}

        <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginLeft: selectedNodeId ? 0 : 'auto', fontFamily: 'var(--font-mono)' }}>
          Drag handles to connect • Click node to edit
        </p>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          deleteKeyCode="Delete"
          fitView
          style={{ background: 'var(--bg-deep)' }}
          defaultEdgeOptions={{ animated: false }}
        >
          <Background color="rgba(255,255,255,0.04)" variant={BackgroundVariant.Dots} gap={24} />
          <Controls style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
          <MiniMap
            nodeColor={n => n.type === 'check' ? '#eab308' : '#ff4500'}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
