import { useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TopologyNode, TopologyEdge } from './types';
import { EDGE_OPACITY } from './constants';
import type { LodLevel } from './useLodLevel';
import TroikaText from './TroikaText';

type Props = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedId: string | null;
  positions: Float32Array;
  lodLevel: LodLevel;
  highlightedPath: string[] | null;
};

type EdgeVisual = {
  edge: TopologyEdge;
  si: number;
  ti: number;
  color: string;
  opacity: number;
  isOnPath: boolean;
  isHighlighted: boolean;
  isHovered: boolean;
  edgeKey: string;
};

export default function TopologyEdges({ nodes, edges, selectedId, positions, lodLevel, highlightedPath }: Props) {
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);

  const nodeIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((node, i) => { map[node.id] = i; });
    return map;
  }, [nodes]);

  const pathEdgeSet = useMemo(() => {
    if (!highlightedPath || highlightedPath.length < 2) return null;
    const set = new Set<string>();
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      set.add(`${highlightedPath[i]}-${highlightedPath[i + 1]}`);
      set.add(`${highlightedPath[i + 1]}-${highlightedPath[i]}`);
    }
    return set;
  }, [highlightedPath]);

  const visibleEdges = useMemo(() => {
    if (selectedId) return edges.filter((e) => e.source === selectedId || e.target === selectedId);
    if (pathEdgeSet) return edges.filter((e) => e.weight > 0.5 || pathEdgeSet.has(`${e.source}-${e.target}`));
    return edges.filter((e) => e.weight > 0.5);
  }, [edges, selectedId, pathEdgeSet]);

  const maxEdges = edges.length;
  const positionBuffer = useMemo(() => new Float32Array(maxEdges * 6), [maxEdges]);
  const colorBuffer = useMemo(() => new Float32Array(maxEdges * 6), [maxEdges]);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3));
    return geo;
  }, [positionBuffer, colorBuffer]);

  const tempColor = useMemo(() => new THREE.Color(), []);

  const edgeVisuals = useMemo((): EdgeVisual[] => {
    return visibleEdges.map((edge) => {
      const si = nodeIndexMap[edge.source];
      const ti = nodeIndexMap[edge.target];
      const edgeKey = `${edge.source}-${edge.target}`;
      const isHighlighted = !!(selectedId && (edge.source === selectedId || edge.target === selectedId));
      const isHovered = hoveredEdgeKey === edgeKey;
      const isOnPath = pathEdgeSet?.has(edgeKey) ?? false;

      let color = '#888888';
      let opacity = EDGE_OPACITY;

      if (isOnPath) { color = '#2dd4bf'; opacity = 0.8; }
      else if (isHighlighted || isHovered) { color = '#ffffff'; opacity = EDGE_OPACITY * 4; }

      return { edge, si, ti, color, opacity, isOnPath, isHighlighted, isHovered, edgeKey };
    }).filter((v) => v.si !== undefined && v.ti !== undefined);
  }, [visibleEdges, nodeIndexMap, selectedId, hoveredEdgeKey, pathEdgeSet]);

  useFrame(() => {
    let idx = 0;
    for (const v of edgeVisuals) {
      const si3 = v.si * 3;
      const ti3 = v.ti * 3;
      const base = idx * 6;
      positionBuffer[base] = positions[si3];
      positionBuffer[base + 1] = positions[si3 + 1];
      positionBuffer[base + 2] = positions[si3 + 2];
      positionBuffer[base + 3] = positions[ti3];
      positionBuffer[base + 4] = positions[ti3 + 1];
      positionBuffer[base + 5] = positions[ti3 + 2];

      tempColor.set(v.color);
      const a = v.opacity;
      colorBuffer[base] = tempColor.r * a;
      colorBuffer[base + 1] = tempColor.g * a;
      colorBuffer[base + 2] = tempColor.b * a;
      colorBuffer[base + 3] = tempColor.r * a;
      colorBuffer[base + 4] = tempColor.g * a;
      colorBuffer[base + 5] = tempColor.b * a;
      idx++;
    }
    geometry.setDrawRange(0, idx * 2);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  const handlePointerOver = useCallback((key: string) => {
    setHoveredEdgeKey(key);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    setHoveredEdgeKey(null);
    document.body.style.cursor = 'auto';
  }, []);

  const labelEdges = edgeVisuals.filter((v) =>
    lodLevel !== 'far' && (v.isHovered || v.isHighlighted || v.isOnPath) && v.edge.label !== 'relates to',
  );

  return (
    <>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={1} />
      </lineSegments>

      {edgeVisuals.map((v) => {
        const si3 = v.si * 3;
        const ti3 = v.ti * 3;
        const sx = positions[si3], sy = positions[si3 + 1], sz = positions[si3 + 2];
        const tx = positions[ti3], ty = positions[ti3 + 1], tz = positions[ti3 + 2];
        const mx = (sx + tx) / 2, my = (sy + ty) / 2, mz = (sz + tz) / 2;
        const dx = tx - sx, dy = ty - sy, dz = tz - sz;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return (
          <mesh
            key={v.edgeKey}
            position={[mx, my, mz]}
            onPointerOver={() => handlePointerOver(v.edgeKey)}
            onPointerOut={handlePointerOut}
            visible={false}>
            <boxGeometry args={[len, 0.15, 0.15]} />
          </mesh>
        );
      })}

      {labelEdges.map((v) => {
        const si3 = v.si * 3;
        const ti3 = v.ti * 3;
        const midpoint: [number, number, number] = [
          (positions[si3] + positions[ti3]) / 2,
          (positions[si3 + 1] + positions[ti3 + 1]) / 2 + 0.15,
          (positions[si3 + 2] + positions[ti3 + 2]) / 2,
        ];
        return (
          <TroikaText
            key={`label-${v.edgeKey}`}
            text={v.edge.label}
            fontSize={0.1}
            position={midpoint}
            color={v.isOnPath ? '#2dd4bf' : '#ffffff'}
            fillOpacity={0.8}
            anchorX="center"
            anchorY="middle"
          />
        );
      })}
    </>
  );
}
