import { useState, useRef, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { TopologyData } from './types';

type Props = {
  data: TopologyData;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export default function SearchOverlay({ data, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () => new Fuse(data.nodes, { keys: ['title', 'domain', 'tags'], threshold: 0.4 }),
    [data.nodes],
  );

  const results = useMemo(() => {
    if (!query.trim()) return data.nodes.slice(0, 5);
    return fuse.search(query).slice(0, 7).map((r) => r.item);
  }, [query, fuse, data.nodes]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIndex]) { onSelect(results[selectedIndex].id); onClose(); }
  };

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, width: 360,
    }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="search units..."
        style={{
          width: '100%', padding: '8px 12px', boxSizing: 'border-box',
          background: 'rgba(5,5,12,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 13, outline: 'none',
          fontFamily: 'var(--font-mono, monospace)', borderRadius: '6px 6px 0 0',
        }}
      />
      {results.length > 0 && (
        <div style={{
          background: 'rgba(5,5,12,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          borderTop: 'none', maxHeight: 280, overflowY: 'auto',
          borderRadius: '0 0 6px 6px',
        }}>
          {results.map((node, i) => (
            <div
              key={node.id}
              onClick={() => { onSelect(node.id); onClose(); }}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                padding: '6px 12px', cursor: 'pointer',
                fontSize: 12, color: i === selectedIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                background: i === selectedIndex ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{node.title}</div>
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
