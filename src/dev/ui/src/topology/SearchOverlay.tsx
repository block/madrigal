import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { api } from '../api';
import type { TopologyData, SemanticQueryResult } from './types';

type Props = {
  data: TopologyData;
  onSelect: (id: string) => void;
  onClose: () => void;
  onSemanticResult?: (result: SemanticQueryResult | null) => void;
};

export default function SearchOverlay({ data, onSelect, onClose, onSemanticResult }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [semanticResults, setSemanticResults] = useState<{ nodeId: string; similarity: number }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasSemantic = !!data.semanticIndex;

  const fuse = useMemo(
    () => new Fuse(data.nodes, { keys: ['title', 'domain', 'tags'], threshold: 0.4 }),
    [data.nodes],
  );

  const nodeMap = useMemo(() => {
    const map: Record<string, typeof data.nodes[0]> = {};
    for (const n of data.nodes) map[n.id] = n;
    return map;
  }, [data.nodes]);

  // fuzzy text results (always available as fallback)
  const fuzzyResults = useMemo(() => {
    if (!query.trim()) return data.nodes.slice(0, 5);
    return fuse.search(query).slice(0, 7).map((r) => r.item);
  }, [query, fuse, data.nodes]);

  // semantic search (debounced)
  const runSemanticSearch = useCallback((q: string) => {
    if (!hasSemantic || !q.trim()) {
      setSemanticResults(null);
      onSemanticResult?.(null);
      return;
    }
    setSearching(true);
    api.topologyQuery({ query: q, limit: 7 })
      .then((result) => {
        setSemanticResults(result.matches);
        onSemanticResult?.(result);
        setSearching(false);
      })
      .catch(() => {
        setSemanticResults(null);
        onSemanticResult?.(null);
        setSearching(false);
      });
  }, [hasSemantic, onSemanticResult]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (hasSemantic) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSemanticSearch(value), 300);
    }
  }, [hasSemantic, runSemanticSearch]);

  // use semantic results if available, else fuzzy
  const results = useMemo(() => {
    if (semanticResults && query.trim()) {
      return semanticResults.map((m) => ({
        node: nodeMap[m.nodeId],
        similarity: m.similarity,
      })).filter((r) => r.node);
    }
    return fuzzyResults.map((node) => ({ node, similarity: null as number | null }));
  }, [semanticResults, fuzzyResults, nodeMap, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);
  useEffect(() => () => { clearTimeout(debounceRef.current); onSemanticResult?.(null); }, [onSemanticResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIndex]) { onSelect(results[selectedIndex].node.id); onClose(); }
  };

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, width: 360,
    }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hasSemantic ? 'semantic search...' : 'search units...'}
        style={{
          width: '100%', padding: '8px 12px', boxSizing: 'border-box',
          background: 'rgba(5,5,12,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 13, outline: 'none',
          fontFamily: 'var(--font-mono, monospace)', borderRadius: '6px 6px 0 0',
        }}
      />
      {(results.length > 0 || searching) && (
        <div style={{
          background: 'rgba(5,5,12,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          borderTop: 'none', maxHeight: 280, overflowY: 'auto',
          borderRadius: '0 0 6px 6px',
        }}>
          {searching && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              embedding query...
            </div>
          )}
          {results.map(({ node, similarity }, i) => (
            <div
              key={node.id}
              onClick={() => { onSelect(node.id); onClose(); }}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                padding: '6px 12px', cursor: 'pointer',
                fontSize: 12, color: i === selectedIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                background: i === selectedIndex ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{node.title}</span>
                {similarity !== null && (
                  <span style={{ fontSize: 9, color: '#2dd4bf', fontFamily: 'monospace' }}>
                    {Math.round(similarity * 100)}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                {node.domain} / {node.kind} / {node.enforcement}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
