export interface AdapterManifest {
  name: string;
  version: string;
  vendor: string;
  adapterVersion: string;
  supports: { sourceFormats: string[]; targetFormats: string[] };
  capabilities: string[];
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  code?: string;
  source?: string;
}

export interface PolicyOption {
  id: string;
  description: string;
}

export interface AnalyzeResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  compatibility: unknown;
  securityImpact: unknown;
  provenance: unknown;
  policyResult: unknown;
}

export interface ConvertResult {
  ok: boolean;
  output: string | null;
  diagnostics: Diagnostic[];
  compatibility: unknown;
  securityImpact: unknown;
  provenance: unknown;
  policyResult: unknown;
  fieldProvenances: unknown[];
}

const BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchAdapters(): Promise<AdapterManifest[]> {
  return apiFetch('/adapters');
}

export function fetchPolicies(): Promise<{ policies: PolicyOption[]; default: string }> {
  return apiFetch('/policies');
}

export function fetchExample(): Promise<{ source: string; sourceAdapter: string }> {
  return apiFetch('/example');
}

export function analyze(
  source: string,
  sourceAdapter: string,
  targetAdapter: string,
): Promise<AnalyzeResult> {
  return apiFetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, sourceAdapter, targetAdapter }),
  });
}

export function convert(
  source: string,
  sourceAdapter: string,
  targetAdapter: string,
  policy: string,
): Promise<ConvertResult> {
  return apiFetch('/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, sourceAdapter, targetAdapter, policy }),
  });
}
