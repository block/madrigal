import type { PCABasis } from './math.js';
import {
  cosineDistancesToRow,
  fibonacciSphere,
  findMedoid,
  kmeans,
  normalize,
  pca,
  pcaWithBasis,
} from './math.js';

/** Centralized layout: all nodes radiate from the embedding medoid. */
export function computeCentralized(embeddings: number[][]): {
  positions: [number, number, number][];
  medoidIdx: number;
} {
  const n = embeddings.length;
  const medoidIdx = findMedoid(embeddings);

  const pcaCoords = pca(embeddings, 3);

  const center = pcaCoords[medoidIdx];
  const relative = pcaCoords.map((p) => p.map((v, d) => v - center[d]));

  const rPca = relative.map(
    (r) => Math.sqrt(r.reduce((s, v) => s + v * v, 0)) + 1e-9,
  );
  const theta = relative.map((r, i) =>
    Math.acos(Math.max(-1, Math.min(1, r[2] / rPca[i]))),
  );
  const phi = relative.map((r) => Math.atan2(r[1], r[0]));

  const distsFromMedoid = cosineDistancesToRow(embeddings, medoidIdx);
  const maxDist = Math.max(...distsFromMedoid) + 1e-9;
  const radii = distsFromMedoid.map((d) => d / maxDist);

  const x = normalize(
    radii.map((r, i) => r * Math.sin(theta[i]) * Math.cos(phi[i])),
  );
  const y = normalize(
    radii.map((r, i) => r * Math.sin(theta[i]) * Math.sin(phi[i])),
  );
  const z = normalize(radii.map((r, i) => r * Math.cos(theta[i])));

  const positions: [number, number, number][] = [];
  for (let i = 0; i < n; i++) positions.push([x[i], y[i], z[i]]);

  return { positions, medoidIdx };
}

/** Decentralized layout: k-means clusters on a Fibonacci sphere. */
export function computeDecentralized(
  embeddings: number[][],
  nClusters = 7,
): {
  positions: [number, number, number][];
  labels: number[];
  hubPositions: [number, number, number][];
} {
  const n = embeddings.length;
  const k = Math.min(nClusters, n);

  const { labels } = kmeans(embeddings, k);
  const hubPositions = fibonacciSphere(k).map(
    (p) => [p[0] * 0.6, p[1] * 0.6, p[2] * 0.6] as [number, number, number],
  );

  const orbitRadius = 0.25;
  const rawPositions: [number, number, number][] = Array.from(
    { length: n },
    () => [0, 0, 0],
  );

  for (let c = 0; c < k; c++) {
    const indices = labels
      .map((l, i) => (l === c ? i : -1))
      .filter((i) => i >= 0);
    const nIn = indices.length;

    if (nIn === 0) continue;
    if (nIn === 1) {
      rawPositions[indices[0]] = [...hubPositions[c]];
    } else if (nIn === 2) {
      const offset = orbitRadius * 0.3;
      rawPositions[indices[0]] = [
        hubPositions[c][0] - offset,
        hubPositions[c][1],
        hubPositions[c][2],
      ];
      rawPositions[indices[1]] = [
        hubPositions[c][0] + offset,
        hubPositions[c][1],
        hubPositions[c][2],
      ];
    } else {
      const clusterData = indices.map((i) => embeddings[i]);
      const localPca = pca(clusterData, 3);
      const localMax = Math.max(...localPca.flat().map(Math.abs)) + 1e-9;
      for (let li = 0; li < nIn; li++) {
        rawPositions[indices[li]] = [
          hubPositions[c][0] + (localPca[li][0] / localMax) * orbitRadius,
          hubPositions[c][1] + (localPca[li][1] / localMax) * orbitRadius,
          hubPositions[c][2] + (localPca[li][2] / localMax) * orbitRadius,
        ];
      }
    }
  }

  const xs = normalize(rawPositions.map((p) => p[0]));
  const ys = normalize(rawPositions.map((p) => p[1]));
  const zs = normalize(rawPositions.map((p) => p[2]));

  const positions: [number, number, number][] = [];
  for (let i = 0; i < n; i++) positions.push([xs[i], ys[i], zs[i]]);

  return { positions, labels, hubPositions };
}

/** Distributed layout: PCA-3D projection (lightweight fallback for UMAP). */
export function computeDistributed(embeddings: number[][]): {
  positions: [number, number, number][];
  pcaBasis: PCABasis;
  normRanges: { min: [number, number, number]; max: [number, number, number] };
} {
  const { projected: pcaCoords, basis } = pcaWithBasis(embeddings, 3);

  const rawX = pcaCoords.map((p) => p[0]);
  const rawY = pcaCoords.map((p) => p[1]);
  const rawZ = pcaCoords.map((p) => p[2]);

  const xs = normalize(rawX);
  const ys = normalize(rawY);
  const zs = normalize(rawZ);

  const normRanges = {
    min: [Math.min(...rawX), Math.min(...rawY), Math.min(...rawZ)] as [
      number,
      number,
      number,
    ],
    max: [Math.max(...rawX), Math.max(...rawY), Math.max(...rawZ)] as [
      number,
      number,
      number,
    ],
  };

  const positions: [number, number, number][] = pcaCoords.map((_, i) => [
    xs[i],
    ys[i],
    zs[i],
  ]);

  return { positions, pcaBasis: basis, normRanges };
}
