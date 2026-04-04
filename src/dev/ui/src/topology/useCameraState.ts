import { useContext } from 'react';
import { CameraContext, type CameraState } from './CameraProvider';

export default function useCameraState(): React.RefObject<CameraState> {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCameraState must be used within CameraProvider');
  return ctx.stateRef;
}
