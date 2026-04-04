import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { TopologyNode, TopologyView } from './types';
import { ANIMATION_DURATION } from './constants';

export default function useAnimatedPositions(
  nodes: TopologyNode[],
  view: TopologyView,
): Float32Array {
  const count = nodes.length;
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const targets = useMemo(() => new Float32Array(count * 3), [count]);
  const progressRef = useRef(1);
  const prevViewRef = useRef(view);

  if (prevViewRef.current !== view) {
    prevViewRef.current = view;
    progressRef.current = 0;
  }

  for (let i = 0; i < count; i++) {
    const pos = nodes[i].positions[view];
    targets[i * 3] = pos[0];
    targets[i * 3 + 1] = pos[1];
    targets[i * 3 + 2] = pos[2];
  }

  const initialized = useRef(false);
  if (!initialized.current) {
    positions.set(targets);
    initialized.current = true;
  }

  useFrame((_, delta) => {
    if (progressRef.current >= 1) return;
    progressRef.current = Math.min(1, progressRef.current + delta / ANIMATION_DURATION);
    const t = 1 - Math.pow(1 - progressRef.current, 3);
    for (let i = 0; i < positions.length; i++) {
      positions[i] = positions[i] + (targets[i] - positions[i]) * t;
    }
  });

  return positions;
}
