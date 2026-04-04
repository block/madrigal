export const vertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
  }
`;
