import type { KnowledgeUnit } from '../../schema/index.js';

type LlmProvider = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

async function callLlm(
  provider: LlmProvider,
  prompt: string,
  maxTokens = 500,
): Promise<string | null> {
  const baseUrl = (provider.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const model = provider.model ?? 'claude-sonnet-4-6-20250514';

  // Try Anthropic-style API
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.ok) {
      const json = await res.json() as { content: { text: string }[] };
      return json.content[0]?.text ?? null;
    }
  } catch {
    // fall through
  }

  // Try OpenAI-style API
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.ok) {
      const json = await res.json() as { choices: { message: { content: string } }[] };
      return json.choices[0]?.message?.content ?? null;
    }
  } catch {
    // fall through
  }

  return null;
}

export async function nameClustersByLlm(
  units: KnowledgeUnit[],
  labels: number[],
  nClusters: number,
  llmProvider: LlmProvider,
): Promise<Record<number, string>> {
  let clusterInfo = '';
  for (let c = 0; c < nClusters; c++) {
    const members = units.filter((_, i) => labels[i] === c);
    clusterInfo += `\nCLUSTER ${c} (${members.length} units):\n`;
    for (const u of members) {
      clusterInfo += `  - [${u.domain}/${u.kind}] ${u.title}\n`;
    }
  }

  const prompt = `I've clustered a design knowledge base into ${nClusters} groups. Give each cluster a short name (2-4 words) that captures its theme.

${clusterInfo}

Format (one per line, nothing else):
CLUSTER 0: <name>
CLUSTER 1: <name>
...`;

  const text = await callLlm(llmProvider, prompt);
  const names: Record<number, string> = {};

  if (text) {
    for (const match of text.matchAll(/CLUSTER\s+(\d+):\s*(.+)/g)) {
      names[parseInt(match[1])] = match[2].trim().replace(/^\*+|\*+$/g, '');
    }
  }

  return names;
}

export async function labelEdgesByLlm(
  units: KnowledgeUnit[],
  edges: { source: number; target: number; similarity: number }[],
  llmProvider: LlmProvider,
  batchSize = 20,
): Promise<{ label: string; reverseLabel: string }[]> {
  const results: { label: string; reverseLabel: string }[] = [];

  for (let i = 0; i < edges.length; i += batchSize) {
    const batch = edges.slice(i, i + batchSize);
    let pairsText = '';
    for (let idx = 0; idx < batch.length; idx++) {
      const a = units[batch[idx].source];
      const b = units[batch[idx].target];
      pairsText += `\nPAIR ${idx}:\n  A [${a.title}]: ${a.body.slice(0, 200)}\n  B [${b.title}]: ${b.body.slice(0, 200)}\n`;
    }

    const prompt = `For each pair of design knowledge units that are semantic neighbors, describe their relationship in BOTH directions using short verb phrases (2-5 words).

${pairsText}

Format (one line per pair):
PAIR 0: A->B: <verb phrase> | B->A: <verb phrase>
PAIR 1: A->B: <verb phrase> | B->A: <verb phrase>
...`;

    const text = await callLlm(llmProvider, prompt, 1500);

    for (let idx = 0; idx < batch.length; idx++) {
      let label = 'relates to';
      let reverseLabel = 'relates to';
      if (text) {
        const pattern = new RegExp(`PAIR\\s+${idx}:.*?A->B:\\s*(.+?)\\s*\\|\\s*B->A:\\s*(.+?)$`, 'm');
        const match = text.match(pattern);
        if (match) {
          label = match[1].trim().replace(/\.$/, '');
          reverseLabel = match[2].trim().replace(/\.$/, '');
        }
      }
      results.push({ label, reverseLabel });
    }
  }

  return results;
}

/** Fallback cluster naming: use the most common domain in each cluster. */
export function fallbackClusterNames(
  units: KnowledgeUnit[],
  labels: number[],
  nClusters: number,
): Record<number, string> {
  const names: Record<number, string> = {};
  for (let c = 0; c < nClusters; c++) {
    const domains = units
      .filter((_, i) => labels[i] === c)
      .map((u) => u.domain);
    if (domains.length > 0) {
      const counts = new Map<string, number>();
      for (const d of domains) counts.set(d, (counts.get(d) ?? 0) + 1);
      let best = domains[0], bestCount = 0;
      for (const [d, count] of counts) {
        if (count > bestCount) { best = d; bestCount = count; }
      }
      names[c] = best;
    } else {
      names[c] = `Cluster ${c}`;
    }
  }
  return names;
}
