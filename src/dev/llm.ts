/**
 * BYOK LLM completion function factory.
 *
 * Creates an LlmCompletionFn from provider config, using raw fetch (no SDK).
 * Mirrors the topology BYOK pattern for embeddings.
 */

import type { LlmCompletionFn } from '../propose.js';

export interface CompletionProviderOptions {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Create an LlmCompletionFn from BYOK provider config.
 */
export function createCompletionFn(opts: CompletionProviderOptions): LlmCompletionFn {
  switch (opts.provider) {
    case 'openai':
      return createOpenAICompletionFn(opts);
    case 'anthropic':
      return createAnthropicCompletionFn(opts);
    default:
      throw new Error(`Unsupported LLM provider: ${opts.provider}`);
  }
}

function createOpenAICompletionFn(opts: CompletionProviderOptions): LlmCompletionFn {
  const baseUrl = opts.baseUrl || 'https://api.openai.com';
  const model = opts.model || 'gpt-4o-mini';

  return async (prompt: string): Promise<string> => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? '';
  };
}

function createAnthropicCompletionFn(opts: CompletionProviderOptions): LlmCompletionFn {
  const model = opts.model || 'claude-sonnet-4-20250514';

  return async (prompt: string): Promise<string> => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    const textBlock = data.content.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  };
}
