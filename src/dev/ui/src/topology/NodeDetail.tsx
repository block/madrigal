import { useMemo } from 'react';
import type { TopologyData } from './types';

type Props = {
  data: TopologyData;
  selectedId: string;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onFindPath: () => void;
  onOpenUnit: (id: string) => void;
  pathMode: boolean;
};

function computeClusterRole(data: TopologyData, nodeId: string): string | null {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const cluster = data.clusters.find((c) => c.id === node.cluster);
  if (!cluster) return null;
  const clusterNodes = data.nodes.filter((n) => n.cluster === node.cluster);
  if (clusterNodes.length < 3) return null;

  const hubPos = cluster.position;
  const distances = clusterNodes.map((n) => {
    const pos = n.positions.decentralized;
    const dx = pos[0] - hubPos[0], dy = pos[1] - hubPos[1], dz = pos[2] - hubPos[2];
    return { id: n.id, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) };
  });
  distances.sort((a, b) => a.dist - b.dist);
  const rank = distances.findIndex((d) => d.id === nodeId);
  const pct = rank / (distances.length - 1);
  if (pct <= 0.25) return 'core member';
  if (pct >= 0.75) return 'bridge node';
  return null;
}

const ENFORCEMENT_DOT: Record<string, string> = {
  must: '#ef4444',
  should: '#f59e0b',
  may: '#3b82f6',
  context: '#8b5cf6',
  deprecated: '#6b7280',
};

export default function NodeDetail({ data, selectedId, onClose, onSelectNode, onFindPath, onOpenUnit, pathMode }: Props) {
  const node = data.nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  const connections = data.edges
    .filter((e) => e.source === selectedId || e.target === selectedId)
    .map((e) => {
      const isSource = e.source === selectedId;
      const otherId = isSource ? e.target : e.source;
      const otherNode = data.nodes.find((n) => n.id === otherId);
      return { node: otherNode, label: isSource ? e.label : e.reverseLabel, weight: e.weight };
    })
    .filter((c) => c.node)
    .sort((a, b) => b.weight - a.weight);

  const clusterName = data.clusters.find((c) => c.id === node.cluster)?.name || '';
  const clusterRole = useMemo(() => computeClusterRole(data, selectedId), [data, selectedId]);

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 10,
      width: 280, maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
      background: 'rgba(5,5,12,0.92)', border: '1px solid rgba(255,255,255,0.08)',
      padding: 16, fontFamily: 'var(--font-mono, monospace)', color: '#fff',
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {node.domain} / {node.kind}{clusterName ? ` / ${clusterName}` : ''}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>
          x
        </button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{node.title}</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 2,
          color: ENFORCEMENT_DOT[node.enforcement] || '#fff',
          background: 'rgba(255,255,255,0.06)',
        }}>
          {node.enforcement}
        </span>
        {node.brand && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 2 }}>
            {node.brand}
          </span>
        )}
        {node.isMedoid && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 2 }}>
            semantic center
          </span>
        )}
        {clusterRole && (
          <span style={{ fontSize: 9, color: clusterRole === 'bridge node' ? '#2dd4bf' : 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 2 }}>
            {clusterRole}
          </span>
        )}
      </div>

      {node.excerpt && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 4, marginBottom: 8 }}>
          {node.excerpt}
        </div>
      )}

      {node.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {node.tags.slice(0, 6).map((tag) => (
            <span key={tag} style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 2 }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!pathMode && (
          <button
            onClick={onFindPath}
            style={{
              flex: 1, padding: '5px 0', background: 'none',
              border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf',
              fontSize: 10, cursor: 'pointer', borderRadius: 4,
              fontFamily: 'var(--font-mono, monospace)',
            }}>
            find path from here
          </button>
        )}
        <button
          onClick={() => onOpenUnit(selectedId)}
          style={{
            flex: 1, padding: '5px 0', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
            fontSize: 10, cursor: 'pointer', background: 'none', borderRadius: 4,
            fontFamily: 'var(--font-mono, monospace)',
          }}>
          open unit detail
        </button>
      </div>

      {connections.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </div>
          {connections.slice(0, 8).map((conn) => (
            <div
              key={conn.node!.id}
              onClick={() => onSelectNode(conn.node!.id)}
              style={{ cursor: 'pointer', padding: '4px 6px', margin: '0 -6px 6px', borderRadius: 3 }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', flex: 1 }}>{conn.label}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginLeft: 8, flexShrink: 0 }}>{Math.round(conn.weight * 100)}%</div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{conn.node!.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
