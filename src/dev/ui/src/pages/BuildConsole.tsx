import { useState, useEffect } from 'react';
import { api, type StatsResponse, type PipelineResult, type BuildResult } from '../api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
      <header className="mb-12">
        <p className="type-overline mb-4">Pipeline</p>
        <h1 className="type-display">Build</h1>
      </header>

      {/* Controls */}
      <section className="mb-12">
        <div className="flex gap-3 items-end flex-wrap">
          {stats && (
            <div>
              <label className="type-overline block mb-2">Platform</label>
              <Select value={platform || undefined} onValueChange={(v) => setPlatform(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select platform...</SelectItem>
                  {stats.platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={() => runBuild(true)} disabled={loading}>
            Dry Run
          </Button>
          <Button onClick={() => runBuild(false)} disabled={loading}>
            Build All
          </Button>
          <Button variant="outline" onClick={runPreview} disabled={loading || !platform}>
            Preview
          </Button>
        </div>
      </section>

      {loading && <p className="type-caption">Building...</p>}

      {/* Full build results */}
      {buildResult && activeTab === 'full' && (
        <section>
          <div className="flex items-baseline gap-6 mb-2">
            <p className={`type-overline ${buildResult.success ? 'text-text-muted' : 'text-[var(--enforcement-must-text)]'}`}>
              {buildResult.success ? 'Succeeded' : 'Failed'}
            </p>
            <p className="type-mono text-text-faint">
              {buildResult.totalUnits} units
            </p>
          </div>
          <Separator className="mb-8" />

          {buildResult.configWarnings.length > 0 && (
            <div className="mb-8 p-4 rounded-card bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)]">
              {buildResult.configWarnings.map((w, i) => (
                <p key={i} className="type-body text-[var(--enforcement-should-text)]">{w}</p>
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
          <Separator className="mb-8" />
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
    <div className="border-b border-border-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <div className="flex items-baseline gap-4">
          <span className="type-title">{label}</span>
          <span className="type-overline text-text-faint">{result.format}</span>
          <span className="type-mono text-text-faint">{result.unitCount} units</span>
        </div>
        <span className="type-mono text-text-faint">
          {expanded ? '\u2212' : '+'}
        </span>
      </button>
      {expanded && result.output && (
        <pre className="pb-6 overflow-x-auto max-h-96 font-mono text-[0.6875rem] leading-[1.7] text-text-muted whitespace-pre-wrap">
          {result.output}
        </pre>
      )}
      {expanded && !result.output && (
        <p className="type-caption pb-6">No output (dry run)</p>
      )}
    </div>
  );
}
