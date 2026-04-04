import { useRef, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TopologyNode, TopologyEdge } from './types';
import { NODE_BASE_SIZE, NODE_HOVER_SCALE, MEDOID_SCALE, LOD_MID_VISIBLE_COUNT } from './constants';
import type { LodLevel } from './useLodLevel';
import TroikaText from './TroikaText';

type Props = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  positions: Float32Array;
  lodLevel: LodLevel;
  highlightedPath: string[] | null;
};

export default function TopologyNodes({ nodes, edges, selectedId, onSelect, positions, lodLevel, highlightedPath }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const { camera } = useThree();

  const pathSet = useMemo(() => highlightedPath ? new Set(highlightedPath) : null, [highlightedPath]);

  const connectedSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const e of edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, edges]);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      const id = nodes[i].id;
      if (pathSet?.has(id)) tempColor.set('#2dd4bf');
      else if (connectedSet && !connectedSet.has(id)) tempColor.setRGB(0.15, 0.15, 0.18);
      else tempColor.set('#ffffff');
      arr[i * 3] = tempColor.r;
      arr[i * 3 + 1] = tempColor.g;
      arr[i * 3 + 2] = tempColor.b;
    }
    return arr;
  }, [nodes, pathSet, connectedSet, tempColor]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < nodes.length; i++) {
      tempObject.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      let scale = NODE_BASE_SIZE;
      if (nodes[i].isMedoid) scale *= MEDOID_SCALE;
      if (nodes[i].id === hoveredId || nodes[i].id === selectedId) scale *= NODE_HOVER_SCALE;
      if (pathSet?.has(nodes[i].id)) scale *= 1.3;
      if (connectedSet && !connectedSet.has(nodes[i].id)) scale *= 0.6;
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const handlePointerOver = useCallback((e: { instanceId?: number }) => {
    if (e.instanceId !== undefined) {
      setHoveredId(nodes[e.instanceId].id);
      document.body.style.cursor = 'pointer';
    }
  }, [nodes]);

  const handlePointerOut = useCallback(() => {
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  }, []);

  const handleClick = useCallback((e: { instanceId?: number; stopPropagation: () => void }) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const id = nodes[e.instanceId].id;
      onSelect(selectedId === id ? null : id);
    }
  }, [nodes, selectedId, onSelect]);

  const visibleLabelIndices = useMemo(() => {
    if (lodLevel === 'far') return [];
    if (lodLevel === 'near') return nodes.map((_, i) => i);
    const camPos = camera.position;
    const distances = nodes.map((_, i) => {
      const dx = positions[i * 3] - camPos.x;
      const dy = positions[i * 3 + 1] - camPos.y;
      const dz = positions[i * 3 + 2] - camPos.z;
      return { i, dist: dx * dx + dy * dy + dz * dz };
    });
    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, LOD_MID_VISIBLE_COUNT).map((d) => d.i);
  }, [lodLevel, nodes, positions, camera.position]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}>
        <sphereGeometry args={[1, 12, 12]}>
          <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
        </sphereGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      {visibleLabelIndices.map((i) => {
        const node = nodes[i];
        const isActive = node.id === hoveredId || node.id === selectedId;
        const isOnPath = pathSet?.has(node.id);
        const isDimmed = connectedSet && !connectedSet.has(node.id);
        let opacity = isActive || isOnPath ? 0.95 : 0.55;
        if (isDimmed) opacity = 0.08;

        return (
          <TroikaText
            key={node.id}
            text={node.title}
            fontSize={0.12}
            position={[positions[i * 3] + 0.2, positions[i * 3 + 1] + 0.05, positions[i * 3 + 2]]}
            color={isOnPath ? '#2dd4bf' : '#ffffff'}
            fillOpacity={opacity}
            anchorX="left"
            anchorY="middle"
            maxWidth={3}
            fadeWithDistance={!isDimmed}
          />
        );
      })}

      {selectedId && (() => {
        const idx = nodes.findIndex((n) => n.id === selectedId);
        if (idx < 0) return null;
        return (
          <mesh position={[positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]]}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshBasicMaterial color="#ff3333" />
          </mesh>
        );
      })()}
    </>
  );
}
