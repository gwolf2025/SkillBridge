import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConversionPipeline } from '../../../packages/conversion/src/index.js';
import type { ConversionResult, PolicyMode } from '../../../packages/conversion/src/index.js';
import { LocalAdapterRegistry } from '../../../packages/registry-local/src/index.js';
import type { Diagnostic, AdapterManifest } from '../../../packages/adapter-sdk/src/index.js';
import adapterPortable from '../../../adapters/portable/src/index.js';
import adapterClaude from '../../../adapters/claude/src/index.js';
import adapterOpencode from '../../../adapters/opencode/src/index.js';
import adapterCodex from '../../../adapters/codex/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', 'package.json');
const pkgRaw = readFileSync(pkgPath, 'utf-8');
const pkg = JSON.parse(pkgRaw) as { version: string };

export type ExitCode = 0 | 1 | 2;

export interface CliOptions {
  command: string;
  args: string[];
  json: boolean;
  from?: string;
  to?: string;
  policy?: string;
  sourceAdapter?: string;
  targetAdapter?: string;
  help: boolean;
  version: boolean;
}

export interface CliError {
  code: string;
  message: string;
  diagnostics?: Diagnostic[];
}

export interface JsonOutput {
  ok: boolean;
  value?: unknown;
  error?: CliError;
}

function buildRegistry(): LocalAdapterRegistry {
  const registry = new LocalAdapterRegistry();
  registry.register(adapterPortable);
  registry.register(adapterClaude);
  registry.register(adapterOpencode);
  registry.register(adapterCodex);
  return registry;
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    command: '',
    args: [],
    json: false,
    help: false,
    version: false,
  };

  let i = 2;
  const positional: string[] = [];

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg.startsWith('--from=')) {
      opts.from = arg.slice(7);
    } else if (arg === '--from' && i + 1 < argv.length) {
      i++;
      opts.from = argv[i];
    } else if (arg.startsWith('--to=')) {
      opts.to = arg.slice(5);
    } else if (arg === '--to' && i + 1 < argv.length) {
      i++;
      opts.to = argv[i];
    } else if (arg.startsWith('--policy=')) {
      opts.policy = arg.slice(9);
    } else if (arg === '--policy' && i + 1 < argv.length) {
      i++;
      opts.policy = argv[i];
    } else if (arg.startsWith('--source-adapter=')) {
      opts.sourceAdapter = arg.slice(17);
    } else if (arg === '--source-adapter' && i + 1 < argv.length) {
      i++;
      opts.sourceAdapter = argv[i];
    } else if (arg.startsWith('--target-adapter=')) {
      opts.targetAdapter = arg.slice(17);
    } else if (arg === '--target-adapter' && i + 1 < argv.length) {
      i++;
      opts.targetAdapter = argv[i];
    } else if (arg.startsWith('-')) {
      positional.push(arg);
    } else {
      positional.push(arg);
    }
    i++;
  }

  if (positional.length > 0) {
    opts.command = positional[0];
    opts.args = positional.slice(1);
  }

  return opts;
}

function readSourceSource(sourceArg: string): string {
  if (existsSync(sourceArg)) {
    return readFileSync(sourceArg, 'utf-8');
  }
  return sourceArg;
}

function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return '';
  const lines = diagnostics.map((d) => {
    const sev = d.severity.padEnd(7);
    const code = d.code ? ` [${d.code}]` : '';
    return `  ${sev}${code} ${d.message}`;
  });
  return `\nDiagnostics:\n${lines.join('\n')}`;
}

function formatConversionResult(result: ConversionResult): string {
  const lines: string[] = [];
  lines.push(`Source format: ${result.provenance.sourceFormat}`);
  lines.push(`Target format: ${result.provenance.targetFormat}`);
  lines.push(`Source adapter: ${result.provenance.sourceAdapter}`);
  lines.push(`Target adapter: ${result.provenance.targetAdapter}`);

  if (result.provenance.steps.length > 0) {
    lines.push('Steps:');
    for (const step of result.provenance.steps) {
      lines.push(`  - ${step.step} (${step.adapter})`);
    }
  }

  if (result.compatibility) {
    lines.push(`Compatibility: ${result.compatibility.overall}`);
    lines.push(
      `  native: ${result.compatibility.nativeCount}, emulated: ${result.compatibility.emulatedCount}, missing: ${result.compatibility.missingCount}`,
    );
  }

  if (result.policyResult) {
    lines.push(
      `Policy: ${result.policyResult.policy}${result.policyResult.blocked ? ' (BLOCKED)' : ''}`,
    );
  }

  const diagStr = formatDiagnostics(result.diagnostics);
  if (diagStr) lines.push(diagStr);

  if (result.output !== undefined) {
    const outputStr =
      typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
    lines.push(`\nOutput:\n${outputStr}`);
  }

  return lines.join('\n');
}

function formatAdapterTable(manifests: AdapterManifest[]): string {
  if (manifests.length === 0) return 'No adapters registered.';
  const header =
    'Name'.padEnd(22) +
    'Version'.padEnd(12) +
    'Vendor'.padEnd(16) +
    'Source'.padEnd(12) +
    'Target'.padEnd(12) +
    'Capabilities';
  const sep = '-'.repeat(header.length);
  const rows = manifests.map((m) => {
    const src = m.supports.sourceFormats.join(', ');
    const tgt = m.supports.targetFormats.join(', ');
    const caps = m.capabilities.join(', ');
    return `${m.name.padEnd(22)}${m.version.padEnd(12)}${m.vendor.padEnd(16)}${src.padEnd(12)}${tgt.padEnd(12)}${caps}`;
  });
  return [header, sep, ...rows].join('\n');
}

function formatError(err: CliError): string {
  let msg = `Error: ${err.message}`;
  if (err.diagnostics && err.diagnostics.length > 0) {
    msg += formatDiagnostics(err.diagnostics);
  }
  return msg;
}

function serializeJson(obj: JsonOutput): string {
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    },
    2,
  );
}

export function printUsage(): string {
  return [
    'SkillBridge — Write an AI skill once. Run it anywhere.',
    '',
    'Usage: skillbridge [command] [options] [arguments]',
    '',
    'Commands:',
    '  convert          Convert a skill between vendor formats',
    '  list-adapters    List all registered adapters',
    '',
    'Global flags:',
    '  --help, -h       Show this help message',
    '  --version, -v    Print version',
    '  --json           Output in JSON format',
    '',
    'Convert flags:',
    '  --from <format>  Source format (e.g. markdown)',
    '  --to <format>    Target format (e.g. markdown)',
    '  --policy <mode>  Policy mode: strict, safe (default), permissive',
    '  --source-adapter <name>  Preferred source adapter',
    '  --target-adapter <name>  Preferred target adapter',
    '',
    'Examples:',
    '  skillbridge --help',
    '  skillbridge --version',
    '  skillbridge --json list-adapters',
    '  skillbridge convert --from markdown --to markdown my-skill.md',
    '  skillbridge convert --from markdown --to markdown --source-adapter adapter-claude --target-adapter adapter-codex my-skill.md',
  ].join('\n');
}

export function run(argv: string[]): { exitCode: ExitCode; output: string } {
  const opts = parseArgs(argv);

  if (opts.help || (!opts.command && !opts.version)) {
    const text = printUsage();
    return { exitCode: 0, output: text };
  }

  if (opts.version) {
    return { exitCode: 0, output: pkg.version };
  }

  const registry = buildRegistry();

  if (opts.command === 'convert') {
    return runConvert(opts, registry);
  }

  if (opts.command === 'list-adapters') {
    return runListAdapters(opts, registry);
  }

  const err: CliError = { code: 'CLI-001', message: `unknown command '${opts.command}'` };
  if (opts.json) {
    return { exitCode: 1, output: serializeJson({ ok: false, error: err }) };
  }
  return { exitCode: 1, output: formatError(err) };
}

function runConvert(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  const from = opts.from || 'markdown';
  const to = opts.to || 'markdown';
  const sourceArg = opts.args[0];

  if (!sourceArg) {
    const err: CliError = {
      code: 'CLI-002',
      message: 'missing source argument for convert command',
    };
    if (opts.json) {
      return { exitCode: 1, output: serializeJson({ ok: false, error: err }) };
    }
    return { exitCode: 1, output: formatError(err) };
  }

  let source: string;
  try {
    source = readSourceSource(sourceArg);
  } catch (e) {
    const err: CliError = {
      code: 'CLI-004',
      message: `cannot read source: ${e instanceof Error ? e.message : String(e)}`,
    };
    if (opts.json) {
      return { exitCode: 1, output: serializeJson({ ok: false, error: err }) };
    }
    return { exitCode: 1, output: formatError(err) };
  }

  const pipeline = new ConversionPipeline(registry);
  const policy = (opts.policy as PolicyMode) || 'safe';
  const result = pipeline.run(source, from, to, {
    policy,
    sourceAdapterName: opts.sourceAdapter,
    targetAdapterName: opts.targetAdapter,
  });

  if (!result.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: result.error.find((d) => d.severity === 'error')?.message || 'conversion failed',
      diagnostics: result.error,
    };
    if (opts.json) {
      return { exitCode: 1, output: serializeJson({ ok: false, error: err }) };
    }
    return { exitCode: 1, output: formatError(err) };
  }

  const conv = result.value;

  if (opts.json) {
    const diag = conv.diagnostics.length > 0 ? conv.diagnostics : undefined;
    return {
      exitCode: 0,
      output: serializeJson({
        ok: true,
        value: {
          output: conv.output,
          diagnostics: diag,
          compatibility: conv.compatibility,
          securityImpact: conv.securityImpact,
          provenance: conv.provenance,
          manifest: conv.manifest,
          policyResult: conv.policyResult,
          fieldProvenances: conv.fieldProvenances,
        },
      }),
    };
  }

  return { exitCode: 0, output: formatConversionResult(conv) };
}

function runListAdapters(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  const manifests = registry.listAdapters();

  if (opts.json) {
    return { exitCode: 0, output: serializeJson({ ok: true, value: manifests }) };
  }

  return { exitCode: 0, output: formatAdapterTable(manifests) };
}

export async function main(argv?: string[]): Promise<ExitCode> {
  const args = argv ?? process.argv;
  const { exitCode, output } = run(args);
  if (output) {
    if (exitCode === 0) {
      console.log(output);
    } else {
      console.error(output);
    }
  }
  return exitCode;
}
