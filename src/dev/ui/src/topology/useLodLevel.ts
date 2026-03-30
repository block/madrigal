import { useState, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LOD_FAR_THRESHOLD, LOD_NEAR_THRESHOLD, LOD_HYSTERESIS } from './constants';

export type LodLevel = 'far' | 'mid' | 'near';

export default function useLodLevel(): LodLevel {
  const { camera } = useThree();
  const [level, setLevel] = useState<LodLevel>('far');
  const currentRef = useRef<LodLevel>('far');

  useFrame(() => {
    const dist = camera.position.length();
    const current = currentRef.current;
    let next = current;

    if (current === 'far' && dist < LOD_FAR_THRESHOLD - LOD_HYSTERESIS) next = 'mid';
    else if (current === 'mid') {
      if (dist > LOD_FAR_THRESHOLD + LOD_HYSTERESIS) next = 'far';
      else if (dist < LOD_NEAR_THRESHOLD - LOD_HYSTERESIS) next = 'near';
    } else if (current === 'near' && dist > LOD_NEAR_THRESHOLD + LOD_HYSTERESIS) next = 'mid';

    if (next !== current) {
      currentRef.current = next;
      setLevel(next);
    }
  });

  return level;
}
