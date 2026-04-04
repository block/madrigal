import { useMemo } from 'react';
import * as THREE from 'three';

const RING_RADII = [2, 4, 7, 11];
const RING_OPACITY = [0.06, 0.05, 0.04, 0.03];
const AXIS_LENGTH = 16;

export default function SceneDecorations() {
  const rings = useMemo(
    () =>
      RING_RADII.map((r, i) => {
        const geo = new THREE.RingGeometry(r - 0.005, r + 0.005, 96);
        return { geo, opacity: RING_OPACITY[i], key: i };
      }),
    [],
  );

  const axisPoints = useMemo(() => {
    const L = AXIS_LENGTH;
    return [
      { points: [new THREE.Vector3(-L, 0, 0), new THREE.Vector3(L, 0, 0)] },
      { points: [new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)] },
      { points: [new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L)] },
    ];
  }, []);

  const tori = useMemo(() => {
    const seed = [
      { rotation: [Math.PI / 5, Math.PI / 3, 0] as [number, number, number], r: 5 },
      { rotation: [-Math.PI / 4, 0, Math.PI / 6] as [number, number, number], r: 8.5 },
      { rotation: [0, Math.PI / 2.5, -Math.PI / 5] as [number, number, number], r: 3.2 },
    ];
    return seed.map((s, i) => ({
      ...s,
      key: i,
      geo: new THREE.TorusGeometry(s.r, 0.008, 8, 96),
    }));
  }, []);

  return (
    <group>
      {/* concentric rings on XZ plane */}
      {rings.map(({ geo, opacity, key }) => (
        <mesh key={key} geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#ffffff" transparent opacity={opacity} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* axis lines */}
      {axisPoints.map(({ points }, i) => (
        <line key={`axis-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.03} />
        </line>
      ))}

      {/* measurement torus rings */}
      {tori.map(({ geo, rotation, key }) => (
        <mesh key={`torus-${key}`} geometry={geo} rotation={rotation}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.04} wireframe />
        </mesh>
      ))}
    </group>
  );
}
