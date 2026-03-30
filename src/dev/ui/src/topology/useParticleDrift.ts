import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const AMP_XY = 0.015;
const AMP_Z = 0.01;

export default function useParticleDrift(
  basePositions: Float32Array,
  nodeCount: number,
): Float32Array {
  const drifted = useMemo(() => new Float32Array(nodeCount * 3), [nodeCount]);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    for (let i = 0; i < nodeCount; i++) {
      const i3 = i * 3;
      drifted[i3] = basePositions[i3] + Math.sin(t * 0.3 + i * 1.7) * AMP_XY;
      drifted[i3 + 1] = basePositions[i3 + 1] + Math.cos(t * 0.25 + i * 2.3) * AMP_XY;
      drifted[i3 + 2] = basePositions[i3 + 2] + Math.sin(t * 0.2 + i * 0.9) * AMP_Z;
    }
  });

  if (drifted[0] === 0 && basePositions[0] !== 0) {
    drifted.set(basePositions);
  }

  return drifted;
}
