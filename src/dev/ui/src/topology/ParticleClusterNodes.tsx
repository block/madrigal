import { useRef, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TopologyNode, TopologyEdge } from './types';
import {
  DOMAIN_COLORS,
  NODE_HOVER_SCALE,
  MEDOID_SCALE,
  LOD_MID_VISIBLE_COUNT,
  PARTICLES_PER_NODE,
  PARTICLE_CLUSTER_RADIUS,
  PARTICLE_BASE_SIZE,
  PARTICLE_COLOR_JITTER,
} from './constants';
import type { LodLevel } from './useLodLevel';
import TroikaText from './TroikaText';
import useBlobTexture from './useBlobTexture';
import { vertexShader, fragmentShader } from './shaders/particleCluster';

type Props = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  positions: Float32Array;
  lodLevel: LodLevel;
  highlightedPath: string[] | null;
  matchedNodeIds?: Set<string> | null;
};

/* ---------- helpers ---------- */

function hexToHSL(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRGB(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

/* ---------- static particle data (built once per node set) ---------- */

type ParticleData = {
  /** per-particle offsets from node center (N*PPN*3) */
  offsets: Float32Array;
  /** per-particle phase for orbital animation */
  phases: Float32Array;
  /** base colors (N*PPN*3) */
  colors: Float32Array;
  /** base sizes (N*PPN) */
  sizes: Float32Array;
  /** node index per particle (N*PPN) */
  nodeIndices: Float32Array;
  totalCount: number;
};

function buildParticleData(nodes: TopologyNode[]): ParticleData {
  const ppn = PARTICLES_PER_NODE;
  const total = nodes.length * ppn;
  const offsets = new Float32Array(total * 3);
  const phases = new Float32Array(total);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const nodeIndices = new Float32Array(total);

  for (let n = 0; n < nodes.length; n++) {
    const domain = nodes[n].domain || 'default';
    const baseHex = DOMAIN_COLORS[domain] || DOMAIN_COLORS.default;
    const [bh, bs, bl] = hexToHSL(baseHex);

    for (let p = 0; p < ppn; p++) {
      const idx = n * ppn + p;
      nodeIndices[idx] = n;

      // spherical distribution with sqrt density falloff
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = PARTICLE_CLUSTER_RADIUS * Math.pow(Math.random(), 0.5);

      offsets[idx * 3] = r * Math.sin(phi) * Math.cos(theta);
      offsets[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      offsets[idx * 3 + 2] = r * Math.cos(phi);

      phases[idx] = Math.random() * Math.PI * 2;

      // HSL jitter
      const h = bh + (Math.random() - 0.5) * PARTICLE_COLOR_JITTER;
      const s = Math.min(1, Math.max(0, bs + (Math.random() - 0.5) * 0.15));
      const l = Math.min(1, Math.max(0, bl + (Math.random() - 0.5) * 0.12));
      const [cr, cg, cb] = hslToRGB(h, s, l);
      colors[idx * 3] = cr;
      colors[idx * 3 + 1] = cg;
      colors[idx * 3 + 2] = cb;

      // size varies by distance from center (closer = larger)
      const distRatio = r / PARTICLE_CLUSTER_RADIUS;
      sizes[idx] = Math.max(1.2, PARTICLE_BASE_SIZE + Math.random() * 2.0 - distRatio * 1.5);
    }
  }

  return { offsets, phases, colors, sizes, nodeIndices, totalCount: total };
}

/* ---------- component ---------- */

export default function ParticleClusterNodes({
  nodes, edges, selectedId, onSelect, positions, lodLevel, highlightedPath, matchedNodeIds,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const { camera, raycaster, pointer } = useThree();

  const pathSet = useMemo(
    () => (highlightedPath ? new Set(highlightedPath) : null),
    [highlightedPath],
  );

  const connectedSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const e of edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, edges]);

  // build static particle data once when nodes change
  const particleData = useMemo(() => buildParticleData(nodes), [nodes]);
  const { offsets, phases, colors: baseColors, sizes: baseSizes, nodeIndices, totalCount } = particleData;

  // mutable buffers for per-frame updates
  const posBuffer = useMemo(() => new Float32Array(totalCount * 3), [totalCount]);
  const colorBuffer = useMemo(() => new Float32Array(totalCount * 3), [totalCount]);
  const sizeBuffer = useMemo(() => new Float32Array(totalCount), [totalCount]);
  const alphaBuffer = useMemo(() => new Float32Array(totalCount).fill(1), [totalCount]);

  const blobTexture = useBlobTexture();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: blobTexture } },
        vertexShader,
        fragmentShader,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [blobTexture],
  );

  const timeRef = useRef(0);

  // cursor 3D position for repulsion
  const cursorWorld = useRef(new THREE.Vector3());
  const cursorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const cursorRay = useMemo(() => new THREE.Ray(), []);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const ppn = PARTICLES_PER_NODE;

    // update cursor world position via raycasting onto z=0 plane
    raycaster.setFromCamera(pointer, camera);
    cursorRay.copy(raycaster.ray);
    cursorRay.intersectPlane(cursorPlane, cursorWorld.current);

    const cx = cursorWorld.current.x;
    const cy = cursorWorld.current.y;
    const cz = cursorWorld.current.z;
    const repulsionRadius = 2.0;
    const repulsionStrength = 1.5;

    for (let i = 0; i < totalCount; i++) {
      const ni = nodeIndices[i];
      const ni3 = ni * 3;
      const i3 = i * 3;

      // anchor position = node center
      const ax = positions[ni3];
      const ay = positions[ni3 + 1];
      const az = positions[ni3 + 2];

      // orbital motion
      const phase = phases[i];
      const orbit = t * 0.3 + phase;
      let px = ax + offsets[i3] + Math.sin(orbit) * 0.04;
      let py = ay + offsets[i3 + 1] + Math.sin(t * 0.25 + phase) * 0.03 + Math.cos(orbit * 0.7) * 0.02;
      let pz = az + offsets[i3 + 2] + Math.cos(orbit) * 0.04;

      // cursor repulsion
      const dx = px - cx;
      const dy = py - cy;
      const dz = pz - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      let sizeMultiplier = 1;
      if (dist < repulsionRadius && dist > 0.01) {
        const force = Math.pow(1 - dist / repulsionRadius, 2) * repulsionStrength;
        const invDist = 1 / dist;
        px += dx * invDist * force * 0.3;
        py += dy * invDist * force * 0.3;
        pz += dz * invDist * force * 0.3;
        sizeMultiplier = 1 + (1 - dist / repulsionRadius) * 0.4;
      }

      posBuffer[i3] = px;
      posBuffer[i3 + 1] = py;
      posBuffer[i3 + 2] = pz;

      // size pulse
      const pulse = 1 + Math.sin(t + phase) * 0.06;
      const nodeId = nodes[ni].id;

      let scale = 1;
      if (nodes[ni].isMedoid) scale *= MEDOID_SCALE;
      if (nodeId === hoveredId || nodeId === selectedId) scale *= NODE_HOVER_SCALE;
      if (pathSet?.has(nodeId)) scale *= 1.3;
      if (connectedSet && !connectedSet.has(nodeId)) scale *= 0.6;

      sizeBuffer[i] = baseSizes[i] * scale * pulse * sizeMultiplier;

      // color: path=cyan, matched=teal glow, dimmed=dark, else base color
      const isMatched = matchedNodeIds?.has(nodeId);
      if (pathSet?.has(nodeId)) {
        colorBuffer[i3] = 0.176;
        colorBuffer[i3 + 1] = 0.831;
        colorBuffer[i3 + 2] = 0.749;
      } else if (isMatched) {
        // blend base color toward cyan
        colorBuffer[i3] = baseColors[i3] * 0.4 + 0.176 * 0.6;
        colorBuffer[i3 + 1] = baseColors[i3 + 1] * 0.4 + 0.831 * 0.6;
        colorBuffer[i3 + 2] = baseColors[i3 + 2] * 0.4 + 0.749 * 0.6;
      } else if (matchedNodeIds && !isMatched) {
        // dim non-matched when semantic search is active
        colorBuffer[i3] = baseColors[i3] * 0.2;
        colorBuffer[i3 + 1] = baseColors[i3 + 1] * 0.2;
        colorBuffer[i3 + 2] = baseColors[i3 + 2] * 0.2;
      } else if (connectedSet && !connectedSet.has(nodeId)) {
        colorBuffer[i3] = baseColors[i3] * 0.2;
        colorBuffer[i3 + 1] = baseColors[i3 + 1] * 0.2;
        colorBuffer[i3 + 2] = baseColors[i3 + 2] * 0.2;
      } else {
        colorBuffer[i3] = baseColors[i3];
        colorBuffer[i3 + 1] = baseColors[i3 + 1];
        colorBuffer[i3 + 2] = baseColors[i3 + 2];
      }

      // alpha
      if (matchedNodeIds && !isMatched) alphaBuffer[i] = 0.15;
      else if (connectedSet && !connectedSet.has(nodeId)) alphaBuffer[i] = 0.15;
      else alphaBuffer[i] = 1;
    }

    const pts = pointsRef.current;
    if (!pts) return;
    const geo = pts.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  });

  // raycasting: find nearest node to pointer
  const hoveredNodeRef = useRef<string | null>(null);

  const handlePointerMove = useCallback(
    (e: THREE.Event & { point?: THREE.Vector3 }) => {
      if (!pointsRef.current) return;
      // use raycaster on points
      const intersections = raycaster.intersectObject(pointsRef.current);
      if (intersections.length > 0) {
        const particleIdx = intersections[0].index;
        if (particleIdx !== undefined) {
          const ni = nodeIndices[particleIdx];
          const id = nodes[ni].id;
          if (hoveredNodeRef.current !== id) {
            hoveredNodeRef.current = id;
            setHoveredId(id);
            document.body.style.cursor = 'pointer';
          }
          return;
        }
      }
      if (hoveredNodeRef.current !== null) {
        hoveredNodeRef.current = null;
        setHoveredId(null);
        document.body.style.cursor = 'auto';
      }
    },
    [nodes, nodeIndices, raycaster],
  );

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (hoveredNodeRef.current !== null) {
        const id = hoveredNodeRef.current;
        onSelect(selectedId === id ? null : id);
      }
    },
    [selectedId, onSelect],
  );

  // labels (same LOD logic as before)
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
      <points
        ref={pointsRef}
        material={material}
        frustumCulled={false}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[colorBuffer, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizeBuffer, 1]} />
          <bufferAttribute attach="attributes-alpha" args={[alphaBuffer, 1]} />
        </bufferGeometry>
      </points>

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
