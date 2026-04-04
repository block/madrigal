import type { EmbeddingProvider } from './types.js';

/** OpenAI-compatible provider (works with OpenAI, Azure OpenAI, any compatible API). */
export function createOpenAIProvider(opts: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  dimensions?: number;
}): EmbeddingProvider {
  const model = opts.model ?? 'text-embedding-3-small';
  const baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const dimensions = opts.dimensions ?? 1536;

  return {
    name: `openai/${model}`,
    dimensions,
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += 100) {
        const batch = texts.slice(i, i + 100);
        const res = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${opts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: batch, model, dimensions }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Embedding API error (${res.status}): ${err}`);
        }
        const json = await res.json() as { data: { embedding: number[] }[] };
        results.push(...json.data.map((d: { embedding: number[] }) => d.embedding));
      }
      return results;
    },
  };
}

/** Voyage AI provider. */
export function createVoyageProvider(opts: {
  apiKey: string;
  model?: string;
}): EmbeddingProvider {
  const model = opts.model ?? 'voyage-3-lite';
  return {
    name: `voyage/${model}`,
    dimensions: model.includes('lite') ? 512 : 1024,
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += 128) {
        const batch = texts.slice(i, i + 128);
        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${opts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: batch, model }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Voyage API error (${res.status}): ${err}`);
        }
        const json = await res.json() as { data: { embedding: number[] }[] };
        results.push(...json.data.map((d: { embedding: number[] }) => d.embedding));
      }
      return results;
    },
  };
}

/** Create provider from environment variables. */
export function createProviderFromEnv(): EmbeddingProvider | null {
  const provider = process.env.MADRIGAL_EMBEDDING_PROVIDER;
  const apiKey = process.env.MADRIGAL_API_KEY;

  if (!provider || !apiKey) return null;

  switch (provider) {
    case 'openai':
      return createOpenAIProvider({
        apiKey,
        model: process.env.MADRIGAL_EMBEDDING_MODEL,
        baseUrl: process.env.MADRIGAL_EMBEDDING_BASE_URL,
      });
    case 'voyage':
      return createVoyageProvider({
        apiKey,
        model: process.env.MADRIGAL_EMBEDDING_MODEL,
      });
    default:
      return null;
  }
}
