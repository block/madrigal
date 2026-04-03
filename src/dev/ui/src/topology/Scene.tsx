import { useRef, useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { TopologyData, TopologyView, SemanticQueryResult } from './types';
import ParticleClusterNodes from './ParticleClusterNodes';
import TopologyEdges from './TopologyEdges';
import TopologyLabels from './TopologyLabels';
import ClusterBrackets from './ClusterBrackets';
import SceneDecorations from './SceneDecorations';
import QueryMarker from './QueryMarker';
import CameraProvider from './CameraProvider';
import useAnimatedPositions from './useAnimatedPositions';
import useCameraAnimation from './useCameraAnimation';
import useParticleDrift from './useParticleDrift';
import useLodLevel from './useLodLevel';

type CameraTarget = {
  position: [number, number, number];
  lookAt: [number, number, number];
} | null;

type Props = {
  data: TopologyData;
  view: TopologyView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  cameraTarget: CameraTarget;
  onCameraComplete?: () => void;
  highlightedPath: string[] | null;
  semanticQuery?: SemanticQueryResult | null;
};

export default function Scene({ data, view, selectedId, onSelect, cameraTarget, onCameraComplete, highlightedPath, semanticQuery }: Props) {
  const basePositions = useAnimatedPositions(data.nodes, view);
  const positions = useParticleDrift(basePositions, data.nodes.length);
  const controlsRef = useRef(null);
  const bloomRef = useRef({ intensity: 0.4, target: 0.4 });

  return (
    <CameraProvider controlsRef={controlsRef}>
      <SceneContent
        data={data}
        view={view}
        selectedId={selectedId}
        onSelect={onSelect}
        positions={positions}
        controlsRef={controlsRef}
        cameraTarget={cameraTarget}
        onCameraComplete={onCameraComplete}
        highlightedPath={highlightedPath}
        bloomRef={bloomRef}
        semanticQuery={semanticQuery}
      />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.7} minDistance={3} maxDistance={25} />
      <DynamicBloom bloomRef={bloomRef} selectedId={selectedId} semanticQuery={semanticQuery} />
    </CameraProvider>
  );
}

function DynamicBloom({
  bloomRef,
  selectedId,
  semanticQuery,
}: {
  bloomRef: React.RefObject<{ intensity: number; target: number }>;
  selectedId: string | null;
  semanticQuery?: SemanticQueryResult | null;
}) {
  const prevSelectedRef = useRef<string | null>(null);
  const prevQueryRef = useRef<SemanticQueryResult | null>(null);

  useFrame(() => {
    const b = bloomRef.current;
    if (!b) return;

    // ramp bloom on selection change
    if (selectedId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedId;
      if (selectedId) {
        b.target = 0.8;
        setTimeout(() => { b.target = 0.4; }, 400);
      }
    }

    // ramp bloom on semantic query
    if (semanticQuery !== prevQueryRef.current) {
      prevQueryRef.current = semanticQuery ?? null;
      if (semanticQuery) {
        b.target = 0.8;
        setTimeout(() => { b.target = 0.4; }, 600);
      }
    }

    b.intensity += (b.target - b.intensity) * 0.03;
  });

  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={bloomRef.current?.intensity ?? 0.4} mipmapBlur />
    </EffectComposer>
  );
}

function SceneContent({
  data, view, selectedId, onSelect, positions, controlsRef, cameraTarget, onCameraComplete, highlightedPath, bloomRef, semanticQuery,
}: {
  data: TopologyData;
  view: TopologyView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  positions: Float32Array;
  controlsRef: React.RefObject<null>;
  cameraTarget: CameraTarget;
  onCameraComplete?: () => void;
  highlightedPath: string[] | null;
  bloomRef: React.RefObject<{ intensity: number; target: number }>;
  semanticQuery?: SemanticQueryResult | null;
}) {
  const lodLevel = useLodLevel();
  useCameraAnimation(controlsRef, cameraTarget, onCameraComplete);

  const matchedNodeIds = useMemo(() => {
    if (!semanticQuery?.matches) return null;
    return new Set(semanticQuery.matches.map((m) => m.nodeId));
  }, [semanticQuery]);

  // compute match node positions for drawing lines from query marker
  const matchPositions = useMemo(() => {
    if (!semanticQuery?.matches || !data.nodes.length) return undefined;
    const nodeIdxMap: Record<string, number> = {};
    data.nodes.forEach((n, i) => { nodeIdxMap[n.id] = i; });
    return semanticQuery.matches.slice(0, 5).map((m) => {
      const idx = nodeIdxMap[m.nodeId];
      if (idx === undefined) return [0, 0, 0] as [number, number, number];
      return [positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]] as [number, number, number];
    });
  }, [semanticQuery, data.nodes, positions]);

  return (
    <>
      <ambientLight intensity={1.2} color="#d4c8b8" />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#fff8f0" />
      <pointLight position={[-15, -5, 10]} intensity={0.4} color="#f0e0c8" />
      <SceneDecorations />
      <ParticleClusterNodes
        nodes={data.nodes}
        edges={data.edges}
        selectedId={selectedId}
        onSelect={onSelect}
        positions={positions}
        lodLevel={lodLevel}
        highlightedPath={highlightedPath}
        matchedNodeIds={matchedNodeIds}
      />
      <TopologyEdges nodes={data.nodes} edges={data.edges} selectedId={selectedId} positions={positions} lodLevel={lodLevel} highlightedPath={highlightedPath} />
      <TopologyLabels clusters={data.clusters} view={view} />
      <ClusterBrackets nodes={data.nodes} positions={positions} view={view} />
      {semanticQuery?.queryPosition && (
        <QueryMarker position={semanticQuery.queryPosition} matchPositions={matchPositions} />
      )}
    </>
  );
}
