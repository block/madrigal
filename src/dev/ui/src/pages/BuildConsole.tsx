import { useState, useEffect } from 'react';
import { api, type StatsResponse, type PipelineResult, type BuildResult } from '../api';

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
  height: 36,
  padding: '0 14px',
  paddingRight: 28,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};

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
    <div>
      {/* Page header */}
      <header className="mb-10">
        <p className="type-overline mb-3">Pipeline</p>
        <h1 className="type-display">Build</h1>
      </header>

      {/* Controls */}
      <section className="mb-10">
        <div className="flex gap-3 items-end flex-wrap">
          {stats && (
            <div>
              <label className="type-overline block mb-2">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="focus:outline-none"
                style={selectStyle}
              >
                <option value="">Select platform...</option>
                {stats.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => runBuild(true)} disabled={loading} className="btn btn-secondary">
            Dry Run
          </button>
          <button onClick={() => runBuild(false)} disabled={loading} className="btn btn-primary">
            Build All
          </button>
          <button onClick={runPreview} disabled={loading || !platform} className="btn btn-secondary">
            Preview
          </button>
        </div>
      </section>

      {loading && <p className="type-caption">Building...</p>}

      {/* Full build results */}
      {buildResult && activeTab === 'full' && (
        <section>
          <div className="flex items-baseline gap-6 mb-2">
            <p className="type-overline" style={{
              color: buildResult.success ? 'var(--text-muted)' : 'var(--enforcement-must-text)'
            }}>
              {buildResult.success ? 'Succeeded' : 'Failed'}
            </p>
            <p className="type-mono" style={{ color: 'var(--text-faint)' }}>
              {buildResult.totalUnits} units
            </p>
          </div>
          <hr className="rule mb-6" />

          {buildResult.configWarnings.length > 0 && (
            <div className="mb-6 p-4" style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--enforcement-should-bg)',
              border: '1px solid var(--enforcement-should-border)',
            }}>
              {buildResult.configWarnings.map((w, i) => (
                <p key={i} className="type-body" style={{ color: 'var(--enforcement-should-text)' }}>{w}</p>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {buildResult.results.map((r, i) => (
              <ResultPanel key={i} result={r} />
            ))}
          </div>
        </section>
      )}

      {/* Preview results */}
      {previewResults && activeTab === 'preview' && (
        <section>
          <p className="type-overline mb-2">Preview</p>
          <hr className="rule mb-6" />
          <div className="space-y-3">
            {previewResults.map((r, i) => (
              <ResultPanel key={i} result={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: BuildResult }) {
  const [expanded, setExpanded] = useState(false);
  const label = result.group ? `${result.platform}/${result.group}` : result.platform;

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <div className="flex items-baseline gap-4">
          <span className="type-title" style={{ fontSize: '0.9375rem' }}>{label}</span>
          <span className="type-overline" style={{ color: 'var(--text-faint)' }}>
            {result.format}
          </span>
          <span className="type-mono" style={{ color: 'var(--text-faint)' }}>
            {result.unitCount} units
          </span>
        </div>
        <span className="type-mono" style={{ color: 'var(--text-faint)' }}>
          {expanded ? '\u2212' : '+'}
        </span>
      </button>
      {expanded && result.output && (
        <pre
          className="pb-6 overflow-x-auto max-h-96"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            lineHeight: 1.7,
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {result.output}
        </pre>
      )}
      {expanded && !result.output && (
        <p className="type-caption pb-6">No output (dry run)</p>
      )}
    </div>
  );
}
