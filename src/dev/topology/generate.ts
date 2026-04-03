import type { KnowledgeUnit } from '../../schema/index.js';
import type { TopologyConfig, TopologyData, TopologyNode } from './types.js';
import { computeCentralized, computeDecentralized, computeDistributed } from './layouts.js';
import { buildKnnEdges } from './math.js';
import { fallbackClusterNames, nameClustersByLlm, labelEdgesByLlm } from './labeler.js';

const MAX_CHARS = 4000;

function unitToText(unit: KnowledgeUnit): string {
  const parts = [unit.title, unit.body.slice(0, MAX_CHARS)];
  if (unit.tags.length) parts.push(unit.tags.join(' '));
  return parts.join('\n');
}

export async function generateTopology(
  units: KnowledgeUnit[],
  config: TopologyConfig = {},
): Promise<TopologyData> {
  const {
    clusters: nClusters = 7,
    neighbors: kNeighbors = 5,
    scale = 5,
    skipLlm = true,
    embeddingProvider,
  } = config;

  if (units.length < 3) {
    throw new Error(`Need at least 3 units to generate topology, got ${units.length}`);
  }

  // 1. Generate embeddings
  let embeddings: number[][];
  let modelName: string;

  if (embeddingProvider) {
    const texts = units.map(unitToText);
    embeddings = await embeddingProvider.embed(texts);
    modelName = embeddingProvider.name;
  } else {
    embeddings = buildPseudoEmbeddings(units);
    modelName = 'bm25-pseudo';
  }

  // 2. Compute layouts
  const { positions: centralizedPos, medoidIdx } = computeCentralized(embeddings);
  const { positions: decentralizedPos, labels: clusterLabels, hubPositions } =
    computeDecentralized(embeddings, Math.min(nClusters, units.length));
  const { positions: distributedPos, pcaBasis, normRanges } = computeDistributed(embeddings);

  // 3. Build edges
  const rawEdges = buildKnnEdges(embeddings, kNeighbors);

  // 4. Optional LLM enrichment
  let clusterNames: Record<number, string>;
  let edgeLabels: { label: string; reverseLabel: string }[];
  const actualClusters = Math.min(nClusters, units.length);

  if (!skipLlm) {
    const llmApiKey = process.env.MADRIGAL_LLM_API_KEY ?? process.env.MADRIGAL_API_KEY;
    const llmProvider = llmApiKey
      ? {
          apiKey: llmApiKey,
          model: process.env.MADRIGAL_LLM_MODEL,
          baseUrl: process.env.MADRIGAL_LLM_BASE_URL,
        }
      : null;

    if (llmProvider) {
      clusterNames = await nameClustersByLlm(units, clusterLabels, actualClusters, llmProvider);
      edgeLabels = await labelEdgesByLlm(units, rawEdges, llmProvider);
    } else {
      clusterNames = fallbackClusterNames(units, clusterLabels, actualClusters);
      edgeLabels = rawEdges.map(() => ({ label: 'relates to', reverseLabel: 'relates to' }));
    }
  } else {
    clusterNames = fallbackClusterNames(units, clusterLabels, actualClusters);
    edgeLabels = rawEdges.map(() => ({ label: 'relates to', reverseLabel: 'relates to' }));
  }

  for (let c = 0; c < actualClusters; c++) {
    if (!clusterNames[c]) clusterNames[c] = `Cluster ${c}`;
  }

  // 5. Build output
  const nodes: TopologyNode[] = units.map((unit, i) => ({
    id: unit.id,
    title: unit.title,
    domain: unit.domain,
    kind: unit.kind,
    enforcement: unit.enforcement,
    brand: unit.brand,
    tags: unit.tags,
    excerpt: unit.body.slice(0, 200).replace(/\n/g, ' ').trim(),
    positions: {
      centralized: [centralizedPos[i][0] * scale, centralizedPos[i][1] * scale, centralizedPos[i][2] * scale],
      decentralized: [decentralizedPos[i][0] * scale, decentralizedPos[i][1] * scale, decentralizedPos[i][2] * scale],
      distributed: [distributedPos[i][0] * scale, distributedPos[i][1] * scale, distributedPos[i][2] * scale],
    },
    cluster: clusterLabels[i],
    isMedoid: i === medoidIdx,
    isLlmCenter: false,
  }));

  const edges = rawEdges.map((edge, i) => ({
    source: units[edge.source].id,
    target: units[edge.target].id,
    label: edgeLabels[i]?.label ?? 'relates to',
    reverseLabel: edgeLabels[i]?.reverseLabel ?? 'relates to',
    weight: Math.round(edge.similarity * 10000) / 10000,
  }));

  const clusterList = Array.from({ length: actualClusters }, (_, c) => ({
    id: c,
    name: clusterNames[c] ?? `Cluster ${c}`,
    position: (hubPositions[c]
      ? [hubPositions[c][0] * scale, hubPositions[c][1] * scale, hubPositions[c][2] * scale]
      : [0, 0, 0]) as [number, number, number],
  }));

  return {
    nodes,
    edges,
    clusters: clusterList,
    metadata: {
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: clusterList.length,
      embeddingModel: modelName,
    },
    semanticIndex: {
      embeddings,
      pcaBasis,
      scale,
      normRanges,
    },
  };
}

/**
 * Build pseudo-embeddings from unit text using simple TF-IDF-like approach.
 * Zero-dependency fallback when no embedding API key is provided.
 */
function buildPseudoEmbeddings(units: KnowledgeUnit[]): number[][] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'not', 'no', 'nor', 'so', 'if', 'then',
    'than', 'as', 'up', 'out', 'about', 'into', 'through', 'during', 'each',
    'all', 'both', 'such', 'when', 'where', 'how', 'what', 'which', 'who',
  ]);

  function tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  }

  const docFreqs = new Map<string, number>();
  const docTokens = units.map((unit) => {
    const tokens = tokenize(unitToText(unit));
    const unique = new Set(tokens);
    for (const t of unique) docFreqs.set(t, (docFreqs.get(t) ?? 0) + 1);
    return tokens;
  });

  const n = units.length;
  const terms = [...docFreqs.entries()]
    .filter(([, df]) => df >= 2 && df < n * 0.9)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 500)
    .map(([term]) => term);

  const termIndex = new Map<string, number>();
  terms.forEach((t, i) => termIndex.set(t, i));
  const dim = terms.length || 1;

  return docTokens.map((tokens) => {
    const vec = new Array(dim).fill(0);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    for (const [term, count] of tf) {
      const idx = termIndex.get(term);
      if (idx !== undefined) {
        const idf = Math.log(n / (docFreqs.get(term) ?? 1));
        vec[idx] = (count / tokens.length) * idf;
      }
    }

    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 1e-9) {
      for (let i = 0; i < dim; i++) vec[i] /= norm;
    }
    return vec;
  });
}
