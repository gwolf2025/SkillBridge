import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  AdapterManifest,
  PolicyOption,
  Diagnostic,
  ConvertResult,
  AnalyzeResult,
} from './api';
import { fetchAdapters, fetchPolicies, fetchExample, analyze, convert } from './api';

type View = 'summary' | 'diagnostics' | 'output' | 'ir';

export function App() {
  const [adapters, setAdapters] = useState<AdapterManifest[]>([]);
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [defaultPolicy, setDefaultPolicy] = useState('safe');
  const [source, setSource] = useState('');
  const [sourceAdapter, setSourceAdapter] = useState('adapter-portable');
  const [targetAdapter, setTargetAdapter] = useState('adapter-claude');
  const [policy, setPolicy] = useState('safe');
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [, setCurrentInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [activeView, setActiveView] = useState<View>('summary');
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAdapters()
      .then(setAdapters)
      .catch(() => {});
    fetchPolicies()
      .then((r) => {
        setPolicies(r.policies);
        setDefaultPolicy(r.default);
        setPolicy(r.default);
      })
      .catch(() => {});
    loadExample();
  }, []);

  function announce(msg: string) {
    if (liveRegionRef.current) liveRegionRef.current.textContent = msg;
  }

  function loadExample() {
    fetchExample()
      .then((ex) => {
        setSource(ex.source);
        setSourceAdapter(ex.sourceAdapter);
        setCurrentInput(ex.source);
        setAnalyzeResult(null);
        setConvertResult(null);
        setApiError('');
        setActiveView('summary');
        announce('Example loaded');
      })
      .catch(() => {});
  }

  function resetAll() {
    setSource('');
    setSourceAdapter('adapter-portable');
    setTargetAdapter('adapter-claude');
    setPolicy(defaultPolicy);
    setAnalyzeResult(null);
    setConvertResult(null);
    setCurrentInput('');
    setApiError('');
    setActiveView('summary');
    announce('Reset to initial state');
  }

  const handleAnalyze = useCallback(async () => {
    if (!source.trim()) {
      setApiError('Please enter skill content');
      return;
    }
    setApiError('');
    setAnalyzing(true);
    setConvertResult(null);
    try {
      const result = await analyze(source, sourceAdapter, targetAdapter);
      setAnalyzeResult(result);
      setCurrentInput(source);
      setActiveView('diagnostics');
      announce(result.ok ? 'Analysis complete' : 'Analysis found issues');
    } catch (e) {
      setApiError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, [source, sourceAdapter, targetAdapter]);

  const handleConvert = useCallback(async () => {
    if (!source.trim()) {
      setApiError('Please enter skill content');
      return;
    }
    setApiError('');
    setConverting(true);
    setConvertResult(null);
    try {
      const result = await convert(source, sourceAdapter, targetAdapter, policy);
      setConvertResult(result);
      setCurrentInput(source);
      if (result.ok) {
        setActiveView('output');
        announce('Conversion complete');
      } else {
        setActiveView('diagnostics');
        announce('Conversion blocked');
      }
    } catch (e) {
      setApiError((e as Error).message);
    } finally {
      setConverting(false);
    }
  }, [source, sourceAdapter, targetAdapter, policy]);

  function countBySeverity(diags: Diagnostic[], sev: string): number {
    return diags.filter((d) => d.severity === sev).length;
  }

  function handleCopy() {
    if (!convertResult?.output) return;
    navigator.clipboard
      .writeText(String(convertResult.output))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        announce('Output copied to clipboard');
      })
      .catch(() => {});
  }

  function handleDownload() {
    if (!convertResult?.output) return;
    const blob = new Blob([String(convertResult.output)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-skill.md';
    a.click();
    URL.revokeObjectURL(url);
    announce('Output downloaded');
  }

  const severityColor = (s: string) => {
    switch (s) {
      case 'error':
        return 'var(--err)';
      case 'warning':
        return 'var(--warn)';
      case 'info':
        return 'var(--info)';
      default:
        return 'inherit';
    }
  };

  return (
    <div className="app">
      <header>
        <h1>
          SkillBridge <span className="badge">Playground</span>
        </h1>
        <p className="tagline">Write an AI skill once. Run it anywhere.</p>
        <p className="alpha-note">
          <span className="badge alpha">α Alpha</span>
          Local-only preview. Your skill content is not sent anywhere or retained.
        </p>
      </header>

      <div className="main-layout">
        <section className="panel input-panel" aria-label="Input and settings">
          <div className="controls-row">
            <label>
              Source adapter
              <select value={sourceAdapter} onChange={(e) => setSourceAdapter(e.target.value)}>
                {adapters.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} v{a.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target adapter
              <select value={targetAdapter} onChange={(e) => setTargetAdapter(e.target.value)}>
                {adapters.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} v{a.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Policy
              <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor="source-editor" className="visually-hidden">
            Skill source content
          </label>
          <textarea
            id="source-editor"
            className="source-editor"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Paste your SKILL.md content here..."
            rows={16}
            spellCheck={false}
          />

          <div className="button-row">
            <button onClick={loadExample}>Load Example</button>
            <button onClick={handleAnalyze} disabled={analyzing || !source.trim()}>
              {analyzing ? 'Analyzing…' : 'Analyze'}
            </button>
            <button onClick={handleConvert} disabled={converting || !source.trim()}>
              {converting ? 'Converting…' : 'Convert'}
            </button>
            <button onClick={resetAll} className="secondary">
              Reset
            </button>
          </div>

          {apiError && (
            <div className="api-error" role="alert">
              {apiError}
            </div>
          )}
        </section>

        <section className="panel results-panel" aria-label="Results">
          <nav className="tabs" role="tablist" aria-label="Results sections">
            {(['summary', 'diagnostics', 'output', 'ir'] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={activeView === v}
                onClick={() => setActiveView(v)}
              >
                {v === 'summary'
                  ? 'Summary'
                  : v === 'diagnostics'
                    ? 'Diagnostics'
                    : v === 'output'
                      ? 'Output'
                      : 'Normalized IR'}
              </button>
            ))}
          </nav>

          <div className="tab-content" role="tabpanel">
            {activeView === 'summary' && (
              <div>
                {!analyzeResult && !convertResult && (
                  <p className="placeholder">Run Analyze or Convert to see results.</p>
                )}
                {analyzeResult && (
                  <div>
                    <h3>Analysis</h3>
                    <p>
                      Source: {sourceAdapter} → Target: {targetAdapter} | Policy: {policy}
                    </p>
                    <p>Errors: {countBySeverity(analyzeResult.diagnostics, 'error')}</p>
                    <p>Warnings: {countBySeverity(analyzeResult.diagnostics, 'warning')}</p>
                    <p>Info: {countBySeverity(analyzeResult.diagnostics, 'info')}</p>
                  </div>
                )}
                {convertResult && (
                  <div>
                    <h3>Conversion</h3>
                    <p>Status: {convertResult.ok ? 'Success' : 'Blocked'}</p>
                    <p>
                      Source: {sourceAdapter} → Target: {targetAdapter} | Policy: {policy}
                    </p>
                    {convertResult.ok && (
                      <p>Output length: {String(convertResult.output).length} characters</p>
                    )}
                    {convertResult.ok && <p>Filename: converted-skill.md</p>}
                  </div>
                )}
              </div>
            )}

            {activeView === 'diagnostics' && (
              <div>
                {!analyzeResult && !convertResult && (
                  <p className="placeholder">No diagnostics yet.</p>
                )}
                {((analyzeResult?.diagnostics?.length || 0) > 0 ||
                  (convertResult?.diagnostics?.length || 0) > 0) && (
                  <table className="diag-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Severity</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(convertResult?.diagnostics || analyzeResult?.diagnostics || []).map(
                        (d, i) => (
                          <tr key={i}>
                            <td style={{ color: severityColor(d.severity) }}>{d.code || '—'}</td>
                            <td>{d.severity}</td>
                            <td>{d.message}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                )}
                {analyzeResult &&
                  analyzeResult.diagnostics.length === 0 &&
                  convertResult?.diagnostics.length === 0 && <p>No diagnostics.</p>}
              </div>
            )}

            {activeView === 'output' && (
              <div>
                {!convertResult && <p className="placeholder">Run Convert to generate output.</p>}
                {convertResult && !convertResult.ok && (
                  <p className="error">Conversion was blocked. See Diagnostics tab.</p>
                )}
                {convertResult?.ok && (
                  <div>
                    <div className="output-actions">
                      <button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy Output'}</button>
                      <button onClick={handleDownload}>Download Output</button>
                    </div>
                    <pre ref={outputRef} className="output-block" data-testid="generated-output">
                      {String(convertResult.output)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeView === 'ir' && (
              <div>
                <p className="placeholder">Normalized IR display is available through the API.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div ref={liveRegionRef} aria-live="polite" className="visually-hidden" />
    </div>
  );
}
