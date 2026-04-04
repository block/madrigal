import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Text } from 'troika-three-text';
import { LABEL_FADE_NEAR, LABEL_FADE_FAR } from './constants';

type Props = {
  text: string;
  fontSize?: number;
  color?: string;
  fillOpacity?: number;
  anchorX?: string | number;
  anchorY?: string | number;
  font?: string;
  maxWidth?: number;
  position?: [number, number, number] | number[];
  billboard?: boolean;
  fadeWithDistance?: boolean;
  fadeNear?: number;
  fadeFar?: number;
};

export default function TroikaText({
  text,
  fontSize = 0.1,
  color = '#ffffff',
  fillOpacity = 1,
  anchorX = 'center',
  anchorY = 'middle',
  font,
  maxWidth,
  position = [0, 0, 0],
  billboard = true,
  fadeWithDistance = false,
  fadeNear = LABEL_FADE_NEAR,
  fadeFar = LABEL_FADE_FAR,
}: Props) {
  const textObj = useMemo(() => new Text(), []);
  const groupRef = useRef<Group>(null!);
  const baseFillOpacity = useRef(fillOpacity);
  baseFillOpacity.current = fillOpacity;

  useEffect(() => {
    textObj.text = text;
    textObj.fontSize = fontSize;
    textObj.color = color;
    textObj.anchorX = anchorX;
    textObj.anchorY = anchorY;
    if (font) textObj.font = font;
    if (maxWidth) textObj.maxWidth = maxWidth;
    textObj.sync();
  }, [textObj, text, fontSize, color, anchorX, anchorY, font, maxWidth]);

  useEffect(() => {
    if (!fadeWithDistance) {
      textObj.fillOpacity = fillOpacity;
      textObj.sync();
    }
  }, [textObj, fillOpacity, fadeWithDistance]);

  useEffect(() => {
    return () => { textObj.dispose(); };
  }, [textObj]);

  useFrame(({ camera }) => {
    if (billboard) textObj.quaternion.copy(camera.quaternion);
    if (fadeWithDistance && groupRef.current) {
      const dx = groupRef.current.position.x - camera.position.x;
      const dy = groupRef.current.position.y - camera.position.y;
      const dz = groupRef.current.position.z - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      let t = 1;
      if (dist > fadeFar) t = 0;
      else if (dist > fadeNear) t = 1 - (dist - fadeNear) / (fadeFar - fadeNear);
      textObj.fillOpacity = baseFillOpacity.current * t;
    }
  });

  return (
    <group ref={groupRef} position={position as [number, number, number]}>
      <primitive object={textObj} />
    </group>
  );
}
