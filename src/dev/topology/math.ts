/** Cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-9 ? 0 : dot / denom;
}

/** Cosine distance = 1 - cosine similarity. */
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

/** Compute cosine distances from all rows to a single target row. */
export function cosineDistancesToRow(
  embeddings: number[][],
  targetIdx: number,
): number[] {
  const target = embeddings[targetIdx];
  return embeddings.map((row) => cosineDistance(row, target));
}

/** Find the medoid: the row closest to the centroid. */
export function findMedoid(embeddings: number[][]): number {
  const n = embeddings.length;
  const dim = embeddings[0].length;

  const centroid = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) centroid[d] += embeddings[i][d];
  }
  for (let d = 0; d < dim; d++) centroid[d] /= n;

  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const dist = cosineDistance(embeddings[i], centroid);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

export type PCABasis = {
  mean: number[];
  components: number[][];
};

/** PCA via power iteration, returning both projections and basis vectors. */
export function pcaWithBasis(
  data: number[][],
  nComponents: number,
): { projected: number[][]; basis: PCABasis } {
  const n = data.length;
  const dim = data[0].length;
  const k = Math.min(nComponents, dim, n);

  const mean = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) mean[d] += data[i][d];
  }
  for (let d = 0; d < dim; d++) mean[d] /= n;

  const centered = data.map((row) => row.map((v, d) => v - mean[d]));
  const components: number[][] = [];
  const residual = centered.map((row) => [...row]);

  for (let c = 0; c < k; c++) {
    let vec = Array.from({ length: dim }, () => Math.random() - 0.5);
    let norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    vec = vec.map((v) => v / norm);

    for (let iter = 0; iter < 100; iter++) {
      const newVec = new Array(dim).fill(0);
      for (let i = 0; i < n; i++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += residual[i][d] * vec[d];
        for (let d = 0; d < dim; d++) newVec[d] += residual[i][d] * dot;
      }
      norm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0));
      if (norm < 1e-12) break;
      vec = newVec.map((v) => v / norm);
    }

    components.push(vec);

    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let d = 0; d < dim; d++) dot += residual[i][d] * vec[d];
      for (let d = 0; d < dim; d++) residual[i][d] -= dot * vec[d];
    }
  }

  const projected: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p = new Array(k).fill(0);
    for (let c = 0; c < k; c++) {
      for (let d = 0; d < dim; d++) {
        p[c] += centered[i][d] * components[c][d];
      }
    }
    if (k < nComponents) {
      while (p.length < nComponents) p.push(0);
    }
    projected.push(p);
  }

  return { projected, basis: { mean, components } };
}

/** Simple PCA via power iteration. Returns top-k principal components projected. */
export function pca(data: number[][], nComponents: number): number[][] {
  const n = data.length;
  const dim = data[0].length;
  const k = Math.min(nComponents, dim, n);

  // Center the data
  const mean = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) mean[d] += data[i][d];
  }
  for (let d = 0; d < dim; d++) mean[d] /= n;

  const centered = data.map((row) => row.map((v, d) => v - mean[d]));
  const components: number[][] = [];
  const residual = centered.map((row) => [...row]);

  for (let c = 0; c < k; c++) {
    let vec = Array.from({ length: dim }, () => Math.random() - 0.5);
    let norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    vec = vec.map((v) => v / norm);

    for (let iter = 0; iter < 100; iter++) {
      const newVec = new Array(dim).fill(0);
      for (let i = 0; i < n; i++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += residual[i][d] * vec[d];
        for (let d = 0; d < dim; d++) newVec[d] += residual[i][d] * dot;
      }
      norm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0));
      if (norm < 1e-12) break;
      vec = newVec.map((v) => v / norm);
    }

    components.push(vec);

    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let d = 0; d < dim; d++) dot += residual[i][d] * vec[d];
      for (let d = 0; d < dim; d++) residual[i][d] -= dot * vec[d];
    }
  }

  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const projected = new Array(k).fill(0);
    for (let c = 0; c < k; c++) {
      for (let d = 0; d < dim; d++) {
        projected[c] += centered[i][d] * components[c][d];
      }
    }
    result.push(projected);
  }

  if (k < nComponents) {
    for (let i = 0; i < n; i++) {
      while (result[i].length < nComponents) result[i].push(0);
    }
  }

  return result;
}

/** K-means clustering. Returns cluster labels for each row. */
export function kmeans(
  data: number[][],
  k: number,
  maxIter = 50,
): { labels: number[]; centroids: number[][] } {
  const n = data.length;
  const dim = data[0].length;
  k = Math.min(k, n);

  // k-means++ initialization
  const centroids: number[][] = [];
  centroids.push([...data[Math.floor(Math.random() * n)]]);

  for (let c = 1; c < k; c++) {
    const dists = data.map((point) => {
      let minDist = Infinity;
      for (const cent of centroids) {
        let d = 0;
        for (let dd = 0; dd < dim; dd++) d += (point[dd] - cent[dd]) ** 2;
        minDist = Math.min(minDist, d);
      }
      return minDist;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      rand -= dists[i];
      if (rand <= 0) { centroids.push([...data[i]]); break; }
    }
    if (centroids.length <= c) centroids.push([...data[Math.floor(Math.random() * n)]]);
  }

  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const newLabels = data.map((point) => {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let dd = 0; dd < dim; dd++) d += (point[dd] - centroids[c][dd]) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
      }
      return best;
    });

    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;

    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length;
      }
    }
  }

  return { labels, centroids };
}

/** Generate n evenly-spaced points on a unit sphere (Fibonacci spiral). */
export function fibonacciSphere(n: number): [number, number, number][] {
  const golden = (1 + Math.sqrt(5)) / 2;
  const points: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi = (2 * Math.PI * i) / golden;
    points.push([
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
    ]);
  }
  return points;
}

/** k-NN edge construction using cosine similarity. */
export function buildKnnEdges(
  embeddings: number[][],
  k = 5,
): { source: number; target: number; similarity: number }[] {
  const n = embeddings.length;
  const kActual = Math.min(k + 1, n);
  const edgeSet = new Set<string>();
  const edges: { source: number; target: number; similarity: number }[] = [];

  for (let i = 0; i < n; i++) {
    const dists = embeddings.map((other, j) => ({
      j,
      dist: cosineDistance(embeddings[i], other),
    }));
    dists.sort((a, b) => a.dist - b.dist);

    for (let ki = 1; ki < Math.min(kActual, dists.length); ki++) {
      const j = dists[ki].j;
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({
          source: Math.min(i, j),
          target: Math.max(i, j),
          similarity: 1 - dists[ki].dist,
        });
      }
    }
  }

  edges.sort((a, b) => b.similarity - a.similarity);
  return edges;
}

/** Normalize an array of values to [-1, 1] range. */
export function normalize(arr: number[]): number[] {
  const mn = Math.min(...arr);
  const mx = Math.max(...arr);
  if (mx - mn < 1e-9) return arr.map(() => 0);
  return arr.map((v) => 2 * (v - mn) / (mx - mn) - 1);
}
