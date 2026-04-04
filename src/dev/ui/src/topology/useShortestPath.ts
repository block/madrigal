import { useMemo } from 'react';
import type { TopologyEdge } from './types';

export default function useShortestPath(
  edges: TopologyEdge[],
  startId: string | null,
  endId: string | null,
): string[] | null {
  return useMemo(() => {
    if (!startId || !endId || startId === endId) return null;

    const adj = new Map<string, { neighbor: string; cost: number }[]>();
    for (const edge of edges) {
      const cost = 1 - edge.weight;
      if (!adj.has(edge.source)) adj.set(edge.source, []);
      if (!adj.has(edge.target)) adj.set(edge.target, []);
      adj.get(edge.source)!.push({ neighbor: edge.target, cost });
      adj.get(edge.target)!.push({ neighbor: edge.source, cost });
    }

    if (!adj.has(startId) || !adj.has(endId)) return null;

    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const visited = new Set<string>();
    dist.set(startId, 0);
    prev.set(startId, null);
    const queue = [startId];

    while (queue.length > 0) {
      queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
      const current = queue.shift()!;
      if (current === endId) break;
      if (visited.has(current)) continue;
      visited.add(current);

      const currentDist = dist.get(current) ?? Infinity;
      for (const { neighbor, cost } of adj.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        const newDist = currentDist + cost;
        if (newDist < (dist.get(neighbor) ?? Infinity)) {
          dist.set(neighbor, newDist);
          prev.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    if (!prev.has(endId)) return null;
    const path: string[] = [];
    let current: string | null = endId;
    while (current !== null) {
      path.unshift(current);
      current = prev.get(current) ?? null;
    }
    return path.length > 1 ? path : null;
  }, [edges, startId, endId]);
}
