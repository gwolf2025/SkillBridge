export function canonicalStringify(value: unknown, space?: string | number): string {
  return JSON.stringify(value, stableKeyReplacer, space ?? 2);
}

function stableKeyReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) {
        sorted[k] = v;
      }
    }
    return sorted;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function normalizeLineEndings(content: string, eol?: string): string {
  const targetEol = eol ?? '\n';
  const normalized = content.replace(/\r\n|\r(?!\n)/g, '\n');
  if (targetEol !== '\n') {
    return normalized.replace(/\n/g, targetEol);
  }
  return normalized;
}

export function stableSortFiles(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower < bLower) return -1;
    if (aLower > bLower) return 1;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}
