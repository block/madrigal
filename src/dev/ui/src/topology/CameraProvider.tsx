import { createContext, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Vector3 } from 'three';

export type CameraState = {
  cameraPosition: Vector3;
  controlsTarget: Vector3;
  distanceToTarget: number;
};

type CameraContextValue = {
  stateRef: React.RefObject<CameraState>;
};

export const CameraContext = createContext<CameraContextValue | null>(null);

type Props = {
  children: ReactNode;
  controlsRef: React.RefObject<{ target: Vector3 } | null>;
};

export default function CameraProvider({ children, controlsRef }: Props) {
  const { camera } = useThree();
  const stateRef = useRef<CameraState>({
    cameraPosition: camera.position.clone(),
    controlsTarget: camera.position.clone().set(0, 0, 0),
    distanceToTarget: camera.position.length(),
  });

  useFrame(() => {
    const state = stateRef.current;
    state.cameraPosition.copy(camera.position);
    if (controlsRef.current) {
      state.controlsTarget.copy(controlsRef.current.target);
    }
    state.distanceToTarget = camera.position.distanceTo(state.controlsTarget);
  });

  return (
    <CameraContext.Provider value={{ stateRef }}>
      {children}
    </CameraContext.Provider>
  );
}
