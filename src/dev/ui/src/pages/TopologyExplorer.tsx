import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import type { TopologyView, TopologyData } from '../topology/types';
import { CAMERA_POSITION, CAMERA_FOV, CAMERA_FLY_OFFSET, VIEW_DESCRIPTIONS } from '../topology/constants';
import useShortestPath from '../topology/useShortestPath';
import Scene from '../topology/Scene';
import NodeDetail from '../topology/NodeDetail';
import SearchOverlay from '../topology/SearchOverlay';
import { api } from '../api';

const VIEW_KEYS: Record<string, TopologyView> = { '1': 'centralized', '2': 'decentralized', '3': 'distributed' };
const VIEW_LABELS: Record<TopologyView, string> = { centralized: '1 centralized', decentralized: '2 decentralized', distributed: '3 distributed' };

type CameraTarget = { position: [number, number, number]; lookAt: [number, number, number] } | null;

function computeFlyTarget(data: TopologyData, nodeId: string, view: TopologyView): CameraTarget {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const pos = node.positions[view];
  return { position: [pos[0], pos[1], pos[2] + CAMERA_FLY_OFFSET], lookAt: [pos[0], pos[1], pos[2]] };
}

type Status = { generated: boolean; unitCount: number; generatedAt: string | null; embeddingModel: string | null };

export function TopologyExplorer() {
  const navigate = useNavigate();
  const [data, setData] = useState<TopologyData | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Viz state
  const [view, setView] = useState<TopologyView>('centralized');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pathMode, setPathMode] = useState(false);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);

  // Generate config
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');

  const pathResult = useShortestPath(data?.edges ?? [], pathStart, pathEnd);

  // Load topology status & data on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await api.topologyStatus();
        setStatus(s);
        if (s.generated) {
          const d = await api.topologyGet();
          setData(d);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.topologyGenerate({
        provider: provider || undefined,
        apiKey: apiKey || undefined,
      });
      const d = await api.topologyGet();
      setData(d);
      const s = await api.topologyStatus();
      setStatus(s);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = useCallback((id: string | null) => {
    if (pathMode && id) {
      if (!pathStart) { setPathStart(id); setSelectedId(id); }
      else if (id !== pathStart) { setPathEnd(id); setSelectedId(id); }
      if (data) setCameraTarget(computeFlyTarget(data, id, view));
      return;
    }
    setSelectedId(id);
    if (id && data) setCameraTarget(computeFlyTarget(data, id, view));
  }, [data, view, pathMode, pathStart]);

  const exitPathMode = useCallback(() => { setPathMode(false); setPathStart(null); setPathEnd(null); }, []);
  const enterPathMode = useCallback(() => { setPathMode(true); setPathStart(selectedId); setPathEnd(null); }, [selectedId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const newView = VIEW_KEYS[e.key];
    if (newView) {
      setView(newView);
      setSelectedId(null);
      exitPathMode();
      setCameraTarget({ position: CAMERA_POSITION, lookAt: [0, 0, 0] });
      return;
    }
    if (e.key === '/') { e.preventDefault(); setSearchOpen(true); return; }
    if (e.key === 'p') { pathMode ? exitPathMode() : enterPathMode(); return; }
    if (e.key === 'Escape') {
      if (searchOpen) setSearchOpen(false);
      else if (pathMode) exitPathMode();
      else { setSelectedId(null); setCameraTarget({ position: CAMERA_POSITION, lookAt: [0, 0, 0] }); }
    }
  }, [searchOpen, pathMode, exitPathMode, enterPathMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const pathStatus = useMemo(() => {
    if (!pathMode) return null;
    if (!pathStart) return 'path: select start node';
    if (!pathEnd) return 'path: select end node';
    if (pathResult) return `path: ${pathResult.length} nodes`;
    return 'path: no route found';
  }, [pathMode, pathStart, pathEnd, pathResult]);

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading topology status...</div>;
  }

  // Not generated yet — show generation UI
  if (!data) {
    return (
      <div style={{ maxWidth: 500, fontFamily: 'var(--font-mono)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Topology Explorer</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
          Generate a 3D semantic topology of your knowledge units. This computes embeddings,
          clusters units into themes, and builds a navigable graph of relationships.
        </p>

        {status && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 6 }}>
            {status.unitCount} units available
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Embedding provider (optional — uses TF-IDF fallback if empty)
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 13,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text)',
              }}>
              <option value="">None (TF-IDF pseudo-embeddings)</option>
              <option value="openai">OpenAI</option>
              <option value="voyage">Voyage AI</option>
            </select>
          </div>

          {provider && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{
                  width: '100%', padding: '6px 8px', fontSize: 13,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
                Key is sent to the server for embedding generation only, not stored.
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || (!!provider && !apiKey)}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: generating ? 'var(--bg-muted)' : 'var(--text)',
            color: generating ? 'var(--text-muted)' : 'var(--bg)',
            border: 'none', borderRadius: 6, cursor: generating ? 'wait' : 'pointer',
            fontFamily: 'var(--font-mono)',
          }}>
          {generating ? 'Generating topology...' : 'Generate Topology'}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Full 3D visualization
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a14' }}>
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => { if (!pathMode) setSelectedId(null); }}>
        <Scene
          data={data}
          view={view}
          selectedId={selectedId}
          onSelect={handleSelect}
          cameraTarget={cameraTarget}
          onCameraComplete={() => setCameraTarget(null)}
          highlightedPath={pathResult}
        />
      </Canvas>

      {searchOpen && (
        <SearchOverlay
          data={data}
          onSelect={(id) => handleSelect(id)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* View indicator */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 10,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
        color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, userSelect: 'none',
      }}>
        {(['centralized', 'decentralized', 'distributed'] as TopologyView[]).map((v) => (
          <div key={v} style={{ color: view === v ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
            {VIEW_LABELS[v]}
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.15)', maxWidth: 200 }}>
          {VIEW_DESCRIPTIONS[view]}
        </div>
      </div>

      {/* Path status */}
      {pathStatus && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 10,
          fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#2dd4bf',
        }}>
          {pathStatus} <span style={{ color: 'rgba(255,255,255,0.3)' }}>[p to exit]</span>
        </div>
      )}

      {/* Stats + hints */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 10,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
        color: 'rgba(255,255,255,0.15)', textAlign: 'right', lineHeight: 1.6,
      }}>
        <div>{data.metadata.nodeCount} units / {data.metadata.edgeCount} connections</div>
        <div>{data.metadata.embeddingModel}</div>
        <div>/ search / p path</div>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute', top: 16, right: selectedId ? 310 : 16, zIndex: 10,
          padding: '4px 10px', fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', borderRadius: 4,
        }}>
        back to dashboard
      </button>

      {/* Node detail panel */}
      {selectedId && (
        <NodeDetail
          data={data}
          selectedId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelectNode={handleSelect}
          onFindPath={enterPathMode}
          onOpenUnit={(id) => navigate(`/units/${id}`)}
          pathMode={pathMode}
        />
      )}
    </div>
  );
}
