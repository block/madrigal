import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_FLY_DURATION } from './constants';

type CameraTarget = {
  position: [number, number, number];
  lookAt: [number, number, number];
} | null;

type OrbitControlsLike = {
  target: THREE.Vector3;
  enabled: boolean;
  update: () => void;
};

export default function useCameraAnimation(
  controlsRef: React.RefObject<OrbitControlsLike | null>,
  target: CameraTarget,
  onComplete?: () => void,
) {
  const { camera } = useThree();
  const progressRef = useRef(1);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const prevTarget = useRef<CameraTarget>(null);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    if (!target) return;

    startPos.current.copy(camera.position);
    endPos.current.set(...target.position);
    if (controlsRef.current) {
      startTarget.current.copy(controlsRef.current.target);
    }
    endTarget.current.set(...target.lookAt);
    progressRef.current = 0;
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [target, camera, controlsRef]);

  useFrame((_, delta) => {
    if (progressRef.current >= 1) return;
    progressRef.current = Math.min(1, progressRef.current + delta / CAMERA_FLY_DURATION);
    const t = 1 - Math.pow(1 - progressRef.current, 3);

    camera.position.lerpVectors(startPos.current, endPos.current, t);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, t);
      controlsRef.current.update();
    }

    if (progressRef.current >= 1) {
      if (controlsRef.current) controlsRef.current.enabled = true;
      onComplete?.();
    }
  });
}
