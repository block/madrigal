import { useState, useEffect } from 'react';
import { api, type StatsResponse, type PipelineResult, type BuildResult } from '../api';

export function BuildConsole() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [platform, setPlatform] = useState('');
  const [buildResult, setBuildResult] = useState<PipelineResult | null>(null);
  const [previewResults, setPreviewResults] = useState<BuildResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'full' | 'preview'>('full');

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  const runBuild = async (dryRun: boolean) => {
    setLoading(true);
    setActiveTab('full');
    const res = await api.build(dryRun);
    setBuildResult(res);
    setPreviewResults(null);
    setLoading(false);
  };

  const runPreview = async () => {
    if (!platform) return;
    setLoading(true);
    setActiveTab('preview');
    const res = await api.buildPreview(platform);
    setPreviewResults(res.results);
    setBuildResult(null);
    setLoading(false);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Build Console</h2>

      <div className="flex gap-3 items-end flex-wrap">
        {stats && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm text-zinc-300"
            >
              <option value="">Select platform…</option>
              {stats.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        <button
          onClick={() => runBuild(true)}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-md bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-50 transition-colors"
        >
          Dry Run (All)
        </button>
        <button
          onClick={() => runBuild(false)}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
        >
          Build All
        </button>
        <button
          onClick={runPreview}
          disabled={loading || !platform}
          className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
        >
          Preview Platform
        </button>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Building…</p>}

      {buildResult && activeTab === 'full' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className={buildResult.success ? 'text-emerald-400' : 'text-red-400'}>
              {buildResult.success ? 'Build succeeded' : 'Build failed'}
            </span>
            <span className="text-zinc-500">{buildResult.totalUnits} unit(s)</span>
          </div>

          {buildResult.configWarnings.length > 0 && (
            <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-3 text-sm text-amber-300">
              {buildResult.configWarnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}

          {buildResult.results.map((r, i) => (
            <ResultPanel key={i} result={r} />
          ))}
        </div>
      )}

      {previewResults && activeTab === 'preview' && (
        <div className="space-y-4">
          {previewResults.map((r, i) => (
            <ResultPanel key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: BuildResult }) {
  const [expanded, setExpanded] = useState(false);
  const label = result.group ? `${result.platform}/${result.group}` : result.platform;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors text-left"
      >
        <div>
          <span className="font-medium text-zinc-200">{label}</span>
          <span className="text-zinc-500 text-sm ml-3">({result.format}) — {result.unitCount} unit(s)</span>
        </div>
        <span className="text-zinc-500 text-sm">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && result.output && (
        <pre className="p-4 border-t border-zinc-800 bg-zinc-950 text-xs text-zinc-300 overflow-x-auto max-h-96">
          {result.output}
        </pre>
      )}
      {expanded && !result.output && (
        <p className="p-4 border-t border-zinc-800 text-sm text-zinc-500">No output (dry run)</p>
      )}
    </div>
  );
}
