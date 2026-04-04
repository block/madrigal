declare module 'troika-three-text' {
  import type { Mesh } from 'three';
  export class Text extends Mesh {
    text: string;
    fontSize: number;
    color: string | number;
    fillOpacity: number;
    anchorX: string | number;
    anchorY: string | number;
    font: string;
    maxWidth: number;
    sync(): void;
    dispose(): void;
  }
}
