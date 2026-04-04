export type TopologyView = 'centralized' | 'decentralized' | 'distributed';

export type TopologyNode = {
  id: string;
  title: string;
  domain: string;
  kind: string;
  enforcement: string;
  brand?: string;
  tags: string[];
  excerpt: string;
  positions: Record<TopologyView, [number, number, number]>;
  cluster: number;
  isMedoid: boolean;
  isLlmCenter: boolean;
};

export type TopologyEdge = {
  source: string;
  target: string;
  label: string;
  reverseLabel: string;
  weight: number;
};

export type TopologyCluster = {
  id: number;
  name: string;
  position: [number, number, number];
};

export type SemanticIndex = {
  embeddings: number[][];
  pcaBasis: {
    mean: number[];
    components: number[][];
  };
  scale: number;
  normRanges: {
    min: [number, number, number];
    max: [number, number, number];
  };
};

export type TopologyData = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  clusters: TopologyCluster[];
  metadata: {
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    embeddingModel: string;
  };
  semanticIndex?: SemanticIndex;
};

export type EmbeddingProvider = {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

export type TopologyConfig = {
  clusters?: number;
  neighbors?: number;
  scale?: number;
  skipLlm?: boolean;
  embeddingProvider?: EmbeddingProvider;
};
