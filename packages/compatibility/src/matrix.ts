import type { CompatibilityReport, CompatibilityLevel } from './index.js';

export interface MatrixCell {
  overall: CompatibilityLevel;
  nativeCount: number;
  emulatedCount: number;
  missingCount: number;
  degradedCount: number;
  partialCount: number;
  unknownCount: number;
}

export interface MatrixResult {
  rows: string[];
  columns: string[];
  results: Record<string, MatrixCell>;
}

export class CompatibilityMatrix {
  formatJson(results: Map<string, CompatibilityReport>): string {
    const { rows, columns } = this.extractLabels(results);
    const matrixResults: Record<string, MatrixCell> = {};

    for (const [key, report] of results) {
      matrixResults[key] = {
        overall: report.overall,
        nativeCount: report.nativeCount,
        emulatedCount: report.emulatedCount,
        missingCount: report.missingCount,
        degradedCount: report.degradedCount,
        partialCount: report.partialCount,
        unknownCount: report.unknownCount,
      };
    }

    return JSON.stringify({ matrix: { rows, columns, results: matrixResults } }, null, 2);
  }

  formatMarkdown(results: Map<string, CompatibilityReport>): string {
    const { rows, columns } = this.extractLabels(results);
    const header = `| Source \\ Target | ${columns.map((c: string) => ` ${c} `).join('|')} |`;
    const sep = `|${columns.map(() => ' --- ').join('|')}|`;
    const body = rows.map((row: string) => {
      const cells = columns.map((col: string) => {
        const key = `${row}->${col}`;
        const report = results.get(key);
        if (!report) return ' — ';
        return ` ${report.overall} (n:${report.nativeCount},e:${report.emulatedCount},m:${report.missingCount}) `;
      });
      return `| ${row} |${cells.join('|')}|`;
    });

    return [header, sep, ...body].join('\n');
  }

  private extractLabels(results: Map<string, CompatibilityReport>): {
    rows: string[];
    columns: string[];
  } {
    const rows = new Set<string>();
    const columns = new Set<string>();

    for (const key of results.keys()) {
      const [src, tgt] = key.split('->');
      if (src) rows.add(src);
      if (tgt) columns.add(tgt);
    }

    return {
      rows: [...rows].sort(),
      columns: [...columns].sort(),
    };
  }
}
