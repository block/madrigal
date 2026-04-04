import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TopologyNode, TopologyView } from './types';

type Props = {
  nodes: TopologyNode[];
  positions: Float32Array;
  view: TopologyView;
};

const BRACKET_LENGTH = 0.6;
const PADDING = 0.5;

export default function ClusterBrackets({ nodes, positions, view }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const clusterMap = useMemo(() => {
    const map = new Map<number, number[]>();
    nodes.forEach((node, i) => {
      if (node.cluster === undefined || node.cluster === null) return;
      if (!map.has(node.cluster)) map.set(node.cluster, []);
      map.get(node.cluster)!.push(i);
    });
    return map;
  }, [nodes]);

  const clusterCount = clusterMap.size;
  const positionBuffer = useMemo(() => new Float32Array(clusterCount * 8 * 2 * 3), [clusterCount]);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
    return geo;
  }, [positionBuffer]);

  useFrame(({ camera }) => {
    if (view !== 'decentralized') {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }
    if (lineRef.current) lineRef.current.visible = true;

    let segIdx = 0;
    clusterMap.forEach((indices) => {
      if (indices.length < 2) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let cx = 0, cy = 0, cz = 0;

      for (const i of indices) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        cx += x; cy += y; cz += z;
      }
      cx /= indices.length; cy /= indices.length; cz /= indices.length;
      minX -= PADDING; maxX += PADDING; minY -= PADDING; maxY += PADDING;

      const bl = BRACKET_LENGTH;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2;

      const toWorld = (lx: number, ly: number): [number, number, number] => [
        cx + right.x * lx + up.x * ly,
        cy + right.y * lx + up.y * ly,
        cz + right.z * lx + up.z * ly,
      ];

      const corners: [number, number, number][][] = [
        [toWorld(-halfW, halfH - bl), toWorld(-halfW, halfH)],
        [toWorld(-halfW, halfH), toWorld(-halfW + bl, halfH)],
        [toWorld(halfW - bl, halfH), toWorld(halfW, halfH)],
        [toWorld(halfW, halfH), toWorld(halfW, halfH - bl)],
        [toWorld(-halfW, -halfH + bl), toWorld(-halfW, -halfH)],
        [toWorld(-halfW, -halfH), toWorld(-halfW + bl, -halfH)],
        [toWorld(halfW - bl, -halfH), toWorld(halfW, -halfH)],
        [toWorld(halfW, -halfH), toWorld(halfW, -halfH + bl)],
      ];

      for (const [p1, p2] of corners) {
        const base = segIdx * 6;
        positionBuffer[base] = p1[0]; positionBuffer[base + 1] = p1[1]; positionBuffer[base + 2] = p1[2];
        positionBuffer[base + 3] = p2[0]; positionBuffer[base + 4] = p2[1]; positionBuffer[base + 5] = p2[2];
        segIdx++;
      }
    });

    geometry.setDrawRange(0, segIdx * 2);
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <lineSegments ref={lineRef} geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}
