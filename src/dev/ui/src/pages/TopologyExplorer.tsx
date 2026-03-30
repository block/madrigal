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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    return <div className="p-10 text-text-muted font-mono">Loading topology status...</div>;
  }

  // Not generated yet — show generation UI
  if (!data) {
    return (
      <div className="max-w-[500px]">
        <header className="mb-12">
          <p className="type-overline mb-4">3D Graph</p>
          <h1 className="type-display">Topology</h1>
        </header>

        <p className="type-body mb-6">
          Generate a 3D semantic topology of your knowledge units. This computes embeddings,
          clusters units into themes, and builds a navigable graph of relationships.
        </p>

        {status && (
          <div className="type-mono text-text-muted mb-4 p-3 bg-background-muted rounded-card-sm">
            {status.unitCount} units available
          </div>
        )}

        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className="type-overline block mb-2">
              Embedding provider (optional — uses TF-IDF fallback if empty)
            </label>
            <Select value={provider || undefined} onValueChange={(v) => setProvider(v === '__none__' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None (TF-IDF pseudo-embeddings)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (TF-IDF pseudo-embeddings)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="voyage">Voyage AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider && (
            <div>
              <label className="type-overline block mb-2">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <div className="type-mono text-[10px] text-text-faint mt-1">
                Key is sent to the server for embedding generation only, not stored.
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || (!!provider && !apiKey)}
        >
          {generating ? 'Generating topology...' : 'Generate Topology'}
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
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
      <div className="absolute bottom-4 left-4 z-10 font-mono text-[11px] leading-relaxed select-none">
        {(['centralized', 'decentralized', 'distributed'] as TopologyView[]).map((v) => (
          <div key={v} style={{ color: view === v ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
            {VIEW_LABELS[v]}
          </div>
        ))}
        <div className="mt-2 text-[9px] max-w-[200px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          {VIEW_DESCRIPTIONS[view]}
        </div>
      </div>

      {/* Path status */}
      {pathStatus && (
        <div className="absolute top-4 left-4 z-10 font-mono text-[11px]" style={{ color: '#2dd4bf' }}>
          {pathStatus} <span style={{ color: 'rgba(255,255,255,0.3)' }}>[p to exit]</span>
        </div>
      )}

      {/* Stats + hints */}
      <div className="absolute bottom-4 right-4 z-10 font-mono text-[11px] text-right leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
        <div>{data.metadata.nodeCount} units / {data.metadata.edgeCount} connections</div>
        <div>{data.metadata.embeddingModel}</div>
        <div>/ search / p path</div>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 z-10 py-1 px-2.5 text-[11px] font-mono rounded-sm cursor-pointer"
        style={{
          right: selectedId ? 310 : 16,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
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
