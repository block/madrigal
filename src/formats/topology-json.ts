import type { KnowledgeUnit } from '../schema/index.js';
import { createProviderFromEnv, generateTopology } from '../topology/index.js';
import type { Format, FormatOptions } from './registry.js';

/**
 * Topology JSON format.
 * Generates a 3D topology graph with embeddings, clustering, and layout positions.
 * Uses TF-IDF pseudo-embeddings by default; set MADRIGAL_EMBEDDING_PROVIDER and
 * MADRIGAL_API_KEY environment variables for higher-quality embeddings.
 */
export const topologyJsonFormat: Format = {
  name: 'topology-json',
  description:
    'Generates a 3D topology graph with embeddings and spatial layout',
  extension: '.json',

  async compile(
    units: KnowledgeUnit[],
    _options: FormatOptions,
  ): Promise<string> {
    if (units.length < 3) {
      return JSON.stringify(
        {
          nodes: [],
          edges: [],
          clusters: [],
          metadata: {
            generatedAt: new Date().toISOString(),
            nodeCount: 0,
            edgeCount: 0,
            clusterCount: 0,
            embeddingModel: 'none',
            skipped: `Need at least 3 units, got ${units.length}`,
          },
        },
        null,
        2,
      );
    }

    const embeddingProvider = createProviderFromEnv() ?? undefined;

    const topology = await generateTopology(units, {
      embeddingProvider,
      skipLlm: true,
    });

    return JSON.stringify(topology, null, 2);
  },
};
