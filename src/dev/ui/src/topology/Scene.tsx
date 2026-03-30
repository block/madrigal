import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { TopologyData, TopologyView } from './types';
import TopologyNodes from './TopologyNodes';
import TopologyEdges from './TopologyEdges';
import TopologyLabels from './TopologyLabels';
import ClusterBrackets from './ClusterBrackets';
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
};

export default function Scene({ data, view, selectedId, onSelect, cameraTarget, onCameraComplete, highlightedPath }: Props) {
  const basePositions = useAnimatedPositions(data.nodes, view);
  const positions = useParticleDrift(basePositions, data.nodes.length);
  const controlsRef = useRef(null);

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
      />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} minDistance={3} maxDistance={25} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} mipmapBlur />
      </EffectComposer>
    </CameraProvider>
  );
}

function SceneContent({
  data, view, selectedId, onSelect, positions, controlsRef, cameraTarget, onCameraComplete, highlightedPath,
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
}) {
  const lodLevel = useLodLevel();
  useCameraAnimation(controlsRef, cameraTarget, onCameraComplete);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      <TopologyNodes nodes={data.nodes} edges={data.edges} selectedId={selectedId} onSelect={onSelect} positions={positions} lodLevel={lodLevel} highlightedPath={highlightedPath} />
      <TopologyEdges nodes={data.nodes} edges={data.edges} selectedId={selectedId} positions={positions} lodLevel={lodLevel} highlightedPath={highlightedPath} />
      <TopologyLabels clusters={data.clusters} view={view} />
      <ClusterBrackets nodes={data.nodes} positions={positions} view={view} />
    </>
  );
}
