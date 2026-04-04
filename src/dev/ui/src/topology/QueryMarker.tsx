import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  position: [number, number, number];
  matchPositions?: [number, number, number][];
};

export default function QueryMarker({ position, matchPositions }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // scale-in animation
    scaleRef.current = Math.min(1, scaleRef.current + delta * 4);
    const t = scaleRef.current;
    const eased = 1 - Math.pow(1 - t, 3);
    groupRef.current.scale.setScalar(eased);

    // slow rotation
    groupRef.current.rotation.y += delta * 0.2;
    groupRef.current.rotation.x += delta * 0.1;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* wireframe globe — 5 rings at different orientations */}
      {[
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
        [0, 0, Math.PI / 2],
        [Math.PI / 4, Math.PI / 4, 0],
        [-Math.PI / 4, Math.PI / 4, 0],
      ].map(([rx, ry, rz], i) => (
        <mesh key={i} rotation={[rx, ry, rz]}>
          <torusGeometry args={[0.18, 0.004, 8, 48]} />
          <meshBasicMaterial color="#2dd4bf" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* match lines */}
      {matchPositions?.map((mp, i) => {
        const points = new Float32Array([
          0, 0, 0,
          mp[0] - position[0], mp[1] - position[1], mp[2] - position[2],
        ]);
        return (
          <line key={`match-${i}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[points, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#2dd4bf" transparent opacity={0.15} />
          </line>
        );
      })}
    </group>
  );
}
