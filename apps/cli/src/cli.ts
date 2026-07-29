import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { ConversionPipeline } from '../../../packages/conversion/src/index.js';
import type { ConversionResult, PolicyMode } from '../../../packages/conversion/src/index.js';
import { LocalAdapterRegistry } from '../../../packages/registry-local/src/index.js';
import type { Diagnostic, AdapterManifest } from '../../../packages/adapter-sdk/src/index.js';
import type { ResolvedInstallPlan } from '../../../packages/installer/src/index.js';
import { parseSkillMd, parseSkillbridgeYaml } from '../../../packages/parser/src/index.js';
import { CAPABILITY_VOCABULARY } from '../../../packages/ir/src/index.js';
import type { Capability } from '../../../packages/ir/src/index.js';
import { AtomicOutputWriter } from '../../../packages/compiler/src/index.js';
import {
  plan as installPlan,
  execute,
  listInstalled,
  formatDryRun,
} from '../../../packages/installer/src/index.js';
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
  format?: string;
  detail?: boolean;
  adapter?: string;
  outputDir?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  force?: boolean;
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

const SECRET_PATTERNS = [
  /TOKEN/i,
  /SECRET/i,
  /API[_ ]?KEY/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /AUTH/i,
  /PRIVATE[_ ]?KEY/i,
  /ACCESS_KEY/i,
];

function isSecretEnvVar(name: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(name));
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
    } else if (arg === '--detail') {
      opts.detail = true;
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
    } else if (arg.startsWith('--format=')) {
      opts.format = arg.slice(9);
    } else if (arg === '--format' && i + 1 < argv.length) {
      i++;
      opts.format = argv[i];
    } else if (arg.startsWith('--adapter=')) {
      opts.adapter = arg.slice(10);
    } else if (arg === '--adapter' && i + 1 < argv.length) {
      i++;
      opts.adapter = argv[i];
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--overwrite') {
      opts.overwrite = true;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg.startsWith('--output-dir=')) {
      opts.outputDir = arg.slice(13);
    } else if (arg === '--output-dir' && i + 1 < argv.length) {
      i++;
      opts.outputDir = argv[i];
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
    const loc = d.location ? ` (${d.location.line}:${d.location.column})` : '';
    return `  ${sev}${code} ${d.message}${loc}`;
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

function formatAdapterDetail(m: AdapterManifest): string {
  const lines: string[] = [];
  lines.push(`  Name:           ${m.name}`);
  lines.push(`  Version:        ${m.version}`);
  lines.push(`  Vendor:         ${m.vendor}`);
  lines.push(`  Adapter Version: ${m.adapterVersion}`);
  lines.push(`  Source Formats:  ${m.supports.sourceFormats.join(', ')}`);
  lines.push(`  Target Formats:  ${m.supports.targetFormats.join(', ')}`);
  lines.push(`  Capabilities:    ${m.capabilities.join(', ')}`);
  if (m.description) lines.push(`  Description:    ${m.description}`);
  if (m.homepage) lines.push(`  Homepage:       ${m.homepage}`);
  return lines.join('\n');
}

function formatAdapterTable(manifests: AdapterManifest[], detail?: boolean): string {
  if (manifests.length === 0) return 'No adapters registered.';
  if (detail) {
    return manifests.map(formatAdapterDetail).join('\n\n');
  }
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
  let msg = `Error [${err.code}]: ${err.message}`;
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

function jsonResult(ok: true, value: unknown): string;
function jsonResult(ok: false, error: CliError): string;
function jsonResult(ok: boolean, valueOrError: unknown): string {
  if (ok) {
    return serializeJson({ ok: true, value: valueOrError });
  }
  return serializeJson({ ok: false, error: valueOrError as CliError });
}

function jsonError(err: CliError): string {
  return jsonResult(false, err);
}

function formatFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ['Frontmatter:'];
  for (const [key, value] of Object.entries(fm)) {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    lines.push(`  ${key}: ${valStr}`);
  }
  return lines.join('\n');
}

function formatSections(sections: Array<{ heading: string; body: string }>): string {
  if (sections.length === 0) return '';
  const lines: string[] = ['Sections:'];
  for (const s of sections) {
    lines.push(`  ## ${s.heading}`);
    if (s.body) {
      const preview = s.body.length > 80 ? s.body.slice(0, 80) + '...' : s.body;
      lines.push(`     ${preview.replace(/\n/g, '\n     ')}`);
    }
  }
  return lines.join('\n');
}

export function printUsage(): string {
  return [
    'SkillBridge — Write an AI skill once. Run it anywhere.',
    '',
    'Usage: skillbridge [command] [options] [arguments]',
    '',
    'Commands:',
    '  convert          Convert a skill file between vendor formats',
    '  compile          Compile a skill package directory',
    '  parse            Parse and display SKILL.md structure',
    '  validate         Validate a skill package directory',
    '  inspect          Show full skill package metadata',
    '  adapters         List registered adapters',
    '  list-adapters    Alias for adapters',
    '  capabilities     List IR capability vocabulary',
    '  doctor           Run local environment diagnostics',
    '  install          Install a skill from a file',
    '  uninstall        Uninstall a skill by name',
    '  list             List installed skills',
    '  verify           Verify integrity of installed skills',
    '  repair           Repair corrupted installed skills',
    '',
    'Global flags:',
    '  --help, -h       Show this help message',
    '  --version, -v    Print version',
    '  --json           Output in JSON format',
    '',
    'Convert/Compile flags:',
    '  --from <format>  Source format (e.g. markdown)',
    '  --to <format>    Target format (e.g. markdown)',
    '  --output-dir <path>  Directory for compiled output',
    '  --dry-run        Preview without writing files',
    '  --overwrite      Allow overwriting existing output directory',
    '  --policy <mode>  Policy mode: strict, safe (default), permissive',
    '  --source-adapter <name>  Preferred source adapter',
    '  --target-adapter <name>  Preferred target adapter',
    '',
    'Adapters flags:',
    '  --format <fmt>   Filter by source/target format',
    '  --detail         Show detailed adapter information',
    '',
    'Install/Uninstall flags:',
    '  --force          Overwrite existing files without confirmation',
    '',
    'Capabilities flags:',
    '  --adapter <name> Show capabilities for a specific adapter',
    '',
    'Examples:',
    '  skillbridge --help',
    '  skillbridge --version',
    '  skillbridge parse my-skill.md',
    '  skillbridge validate ./packages/my-skill/',
    '  skillbridge inspect ./packages/my-skill/ --json',
    '  skillbridge adapters --detail',
    '  skillbridge capabilities --adapter adapter-portable',
    '  skillbridge doctor',
    '  skillbridge install my-skill.md',
    '  skillbridge install --dry-run my-skill.md',
    '  skillbridge uninstall my-skill',
    '  skillbridge list',
    '  skillbridge list --json',
    '  skillbridge verify',
    '  skillbridge repair my-skill',
  ].join('\n');
}

export async function run(argv: string[]): Promise<{ exitCode: ExitCode; output: string }> {
  const opts = parseArgs(argv);

  if (opts.help || (!opts.command && !opts.version)) {
    const text = printUsage();
    return { exitCode: 0, output: text };
  }

  if (opts.version) {
    return { exitCode: 0, output: pkg.version };
  }

  const registry = buildRegistry();

  switch (opts.command) {
    case 'convert':
      return await runConvert(opts, registry);
    case 'compile':
      return await runCompile(opts, registry);
    case 'list-adapters':
    case 'adapters':
      return runAdapters(opts, registry);
    case 'parse':
      return runParse(opts);
    case 'validate':
      return runValidate(opts);
    case 'inspect':
      return runInspect(opts);
    case 'capabilities':
      return runCapabilities(opts, registry);
    case 'doctor':
      return runDoctor(opts, registry);
    case 'install':
      return await runCliInstall(opts, registry);
    case 'uninstall':
      return await runCliUninstall(opts, registry);
    case 'list':
      return runCliList(opts, registry);
    case 'verify':
      return await runCliVerify(opts, registry);
    case 'repair':
      return await runCliRepair(opts, registry);
    default: {
      const err: CliError = { code: 'CLI-001', message: `unknown command '${opts.command}'` };
      if (opts.json) {
        return { exitCode: 1, output: jsonError(err) };
      }
      return { exitCode: 1, output: formatError(err) };
    }
  }
}

async function runConvert(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const from = opts.from || 'markdown';
  const to = opts.to || 'markdown';
  const sourceArg = opts.args[0];

  if (!sourceArg) {
    const err: CliError = {
      code: 'CLI-002',
      message: 'missing source argument for convert command',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
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
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
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
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const conv = result.value;

  if (opts.outputDir) {
    const od = resolve(opts.outputDir);
    if (existsSync(od) && !opts.overwrite && !opts.dryRun) {
      const err: CliError = {
        code: 'CLI-017',
        message: `output directory already exists: ${od}. Use --overwrite to overwrite.`,
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const writer = new AtomicOutputWriter({ outputDir: od, dryRun: opts.dryRun });
    const prepResult = await writer.prepare();
    if (!prepResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: prepResult.error.message,
        diagnostics: [prepResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const outputStr = typeof conv.output === 'string' ? conv.output : JSON.stringify(conv.output);
    const writeResult = await writer.writeFile('output', outputStr);
    if (!writeResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: writeResult.error.message,
        diagnostics: [writeResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const commitResult = await writer.commit();
    if (!commitResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: commitResult.error.message,
        diagnostics: [commitResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }
  }

  if (opts.json) {
    return {
      exitCode: 0,
      output: jsonResult(true, {
        output: conv.output,
        diagnostics: conv.diagnostics.length > 0 ? conv.diagnostics : undefined,
        compatibility: conv.compatibility,
        securityImpact: conv.securityImpact,
        provenance: conv.provenance,
        manifest: conv.manifest,
        policyResult: conv.policyResult,
        fieldProvenances: conv.fieldProvenances,
      }),
    };
  }

  let humanOutput = formatConversionResult(conv);
  if (opts.outputDir && !opts.dryRun) {
    humanOutput += `\nOutput written to: ${resolve(opts.outputDir)}`;
  } else if (opts.outputDir && opts.dryRun) {
    humanOutput += `\nDry-run: would write to ${resolve(opts.outputDir)}`;
  }
  return { exitCode: 0, output: humanOutput };
}

async function runCompile(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const dirArg = opts.args[0];
  if (!dirArg) {
    const err: CliError = {
      code: 'CLI-019',
      message: 'missing directory argument for compile command',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const normalizedPath = resolve(normalize(dirArg));
  if (!existsSync(normalizedPath)) {
    const err: CliError = { code: 'CLI-014', message: `directory not found: ${dirArg}` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const skillMdPath = join(normalizedPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    const err: CliError = { code: 'CLI-014', message: `missing SKILL.md in ${normalizedPath}` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const content = readFileSync(skillMdPath, 'utf-8');
  const to = opts.to || 'markdown';
  const from = opts.from || 'markdown';
  const pipeline = new ConversionPipeline(registry);
  const policy = (opts.policy as PolicyMode) || 'safe';

  const result = pipeline.run(content, from, to, {
    policy,
    sourceAdapterName: opts.sourceAdapter,
    targetAdapterName: opts.targetAdapter,
  });

  if (!result.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: result.error.find((d) => d.severity === 'error')?.message || 'compile failed',
      diagnostics: result.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const conv = result.value;

  if (opts.outputDir) {
    const od = resolve(opts.outputDir);
    if (existsSync(od) && !opts.overwrite && !opts.dryRun) {
      const err: CliError = {
        code: 'CLI-017',
        message: `output directory already exists: ${od}. Use --overwrite to overwrite.`,
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const writer = new AtomicOutputWriter({ outputDir: od, dryRun: opts.dryRun });
    const prepResult = await writer.prepare();
    if (!prepResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: prepResult.error.message,
        diagnostics: [prepResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const outputStr = typeof conv.output === 'string' ? conv.output : JSON.stringify(conv.output);
    const writeResult = await writer.writeFile('output', outputStr);
    if (!writeResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: writeResult.error.message,
        diagnostics: [writeResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    const commitResult = await writer.commit();
    if (!commitResult.ok) {
      const err: CliError = {
        code: 'CLI-018',
        message: commitResult.error.message,
        diagnostics: [commitResult.error],
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }
  }

  if (opts.json) {
    return {
      exitCode: 0,
      output: jsonResult(true, {
        output: conv.output,
        source: normalizedPath,
        diagnostics: conv.diagnostics.length > 0 ? conv.diagnostics : undefined,
        compatibility: conv.compatibility,
        securityImpact: conv.securityImpact,
        provenance: conv.provenance,
        manifest: conv.manifest,
        policyResult: conv.policyResult,
        fieldProvenances: conv.fieldProvenances,
      }),
    };
  }

  let humanOutput = `Compiled: ${normalizedPath}\n${formatConversionResult(conv)}`;
  if (opts.outputDir && !opts.dryRun) {
    humanOutput += `\nOutput written to: ${resolve(opts.outputDir)}`;
  } else if (opts.outputDir && opts.dryRun) {
    humanOutput += `\nDry-run: would write to ${resolve(opts.outputDir)}`;
  }
  return { exitCode: 0, output: humanOutput };
}

function runParse(opts: CliOptions): { exitCode: ExitCode; output: string } {
  const fileArg = opts.args[0];

  if (!fileArg) {
    const err: CliError = { code: 'CLI-010', message: 'missing file argument for parse command' };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  let content: string;
  try {
    content = readFileSync(fileArg, 'utf-8');
  } catch (e) {
    const err: CliError = {
      code: 'CLI-011',
      message: `cannot read file: ${e instanceof Error ? e.message : String(e)}`,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const result = parseSkillMd(content, fileArg);

  if (!result.ok) {
    const err: CliError = { code: 'CLI-012', message: 'parse failed', diagnostics: result.error };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const parsed = result.value;
  const allDiagnostics: Diagnostic[] = parsed.diagnostics ?? [];

  if (opts.json) {
    return {
      exitCode: allDiagnostics.some((d) => d.severity === 'error') ? 1 : 0,
      output: jsonResult(true, {
        frontmatter: parsed.frontmatter,
        sections: parsed.sections,
        extensions: parsed.extensions,
        diagnostics: allDiagnostics.length > 0 ? allDiagnostics : undefined,
      }),
    };
  }

  const lines: string[] = [];
  lines.push(formatFrontmatter(parsed.frontmatter));
  if (parsed.extensions && Object.keys(parsed.extensions).length > 0) {
    lines.push(`Extensions: ${JSON.stringify(parsed.extensions)}`);
  }
  const sectionsStr = formatSections(parsed.sections);
  if (sectionsStr) lines.push(sectionsStr);
  if (allDiagnostics.length > 0) lines.push(formatDiagnostics(allDiagnostics));

  return {
    exitCode: allDiagnostics.some((d) => d.severity === 'error') ? 1 : 0,
    output: lines.join('\n'),
  };
}

function runValidate(opts: CliOptions): { exitCode: ExitCode; output: string } {
  const dirArg = opts.args[0];

  if (!dirArg) {
    const err: CliError = {
      code: 'CLI-013',
      message: 'missing directory argument for validate command',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const normalizedPath = resolve(normalize(dirArg));
  if (!existsSync(normalizedPath)) {
    const err: CliError = { code: 'CLI-014', message: `directory not found: ${dirArg}` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const diagnostics: Diagnostic[] = [];

  const skillMdPath = join(normalizedPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    const err: CliError = {
      code: 'CLI-014',
      message: `missing SKILL.md in ${normalizedPath}`,
      diagnostics: [
        {
          severity: 'error',
          message: `missing required SKILL.md in ${normalizedPath}`,
          code: 'PARSER-001',
        },
      ],
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const parseResult = parseSkillMd(content, skillMdPath);
    if (!parseResult.ok) {
      diagnostics.push(...parseResult.error);
    } else if (parseResult.value.diagnostics) {
      diagnostics.push(...parseResult.value.diagnostics);
    }
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      message: `cannot read SKILL.md: ${e instanceof Error ? e.message : String(e)}`,
      code: 'PARSER-007',
    });
  }

  const yamlPath = join(normalizedPath, 'skillbridge.yaml');
  if (existsSync(yamlPath)) {
    try {
      const yamlContent = readFileSync(yamlPath, 'utf-8');
      const yamlResult = parseSkillbridgeYaml(yamlContent);
      if (!yamlResult.ok) {
        diagnostics.push(...yamlResult.error);
      } else if (yamlResult.value.diagnostics) {
        diagnostics.push(...yamlResult.value.diagnostics);
      }
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `cannot read skillbridge.yaml: ${e instanceof Error ? e.message : String(e)}`,
        code: 'PARSER-007',
      });
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  if (opts.json) {
    return {
      exitCode: hasErrors ? 1 : 0,
      output: jsonResult(true, {
        path: normalizedPath,
        valid: !hasErrors,
        diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
      }),
    };
  }

  const lines: string[] = [];
  if (hasErrors) {
    lines.push(`Validation FAILED for ${normalizedPath}`);
  } else {
    lines.push(`Validation PASSED for ${normalizedPath}`);
  }
  if (diagnostics.length > 0) lines.push(formatDiagnostics(diagnostics));

  return { exitCode: hasErrors ? 1 : 0, output: lines.join('\n') };
}

function runInspect(opts: CliOptions): { exitCode: ExitCode; output: string } {
  const dirArg = opts.args[0];

  if (!dirArg) {
    const err: CliError = {
      code: 'CLI-015',
      message: 'missing directory argument for inspect command',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const normalizedPath = resolve(normalize(dirArg));
  if (!existsSync(normalizedPath)) {
    const err: CliError = { code: 'CLI-014', message: `directory not found: ${dirArg}` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const diagnostics: Diagnostic[] = [];
  const info: Record<string, unknown> = { path: normalizedPath };

  const skillMdPath = join(normalizedPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    const err: CliError = { code: 'CLI-014', message: `missing SKILL.md in ${normalizedPath}` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const parseResult = parseSkillMd(content, skillMdPath);
    if (!parseResult.ok) {
      diagnostics.push(...parseResult.error);
      const err: CliError = {
        code: 'CLI-012',
        message: 'parse failed',
        diagnostics: parseResult.error,
      };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }
    info.frontmatter = parseResult.value.frontmatter;
    info.sections = parseResult.value.sections;
    if (parseResult.value.extensions) info.extensions = parseResult.value.extensions;
    if (parseResult.value.diagnostics) diagnostics.push(...parseResult.value.diagnostics);
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      message: `cannot read SKILL.md: ${e instanceof Error ? e.message : String(e)}`,
      code: 'PARSER-007',
    });
  }

  const manifest: Record<string, unknown> = {};
  const yamlPath = join(normalizedPath, 'skillbridge.yaml');
  if (existsSync(yamlPath)) {
    try {
      const yamlContent = readFileSync(yamlPath, 'utf-8');
      const yamlResult = parseSkillbridgeYaml(yamlContent);
      if (yamlResult.ok) {
        Object.assign(manifest, yamlResult.value.manifest);
        if (yamlResult.value.diagnostics) diagnostics.push(...yamlResult.value.diagnostics);
      } else {
        diagnostics.push(...yamlResult.error);
      }
    } catch (e) {
      diagnostics.push({
        severity: 'warning',
        message: `cannot read skillbridge.yaml: ${e instanceof Error ? e.message : String(e)}`,
        code: 'PARSER-007',
      });
    }
  }
  info.manifest = manifest;

  const resourceDirs: string[] = [];
  try {
    const entries = readdirSync(normalizedPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        resourceDirs.push(entry.name);
      }
    }
  } catch {
    // ignore
  }
  info.resourceDirs = resourceDirs;

  info.hasLicense = existsSync(join(normalizedPath, 'LICENSE'));
  info.hasNotice = existsSync(join(normalizedPath, 'NOTICE'));

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  if (opts.json) {
    return {
      exitCode: hasErrors ? 1 : 0,
      output: jsonResult(true, {
        ...info,
        diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
      }),
    };
  }

  const lines: string[] = [];
  lines.push(`Path: ${normalizedPath}`);

  const fm = info.frontmatter as Record<string, unknown> | undefined;
  if (fm) lines.push(formatFrontmatter(fm));
  if (info.extensions) lines.push(`Extensions: ${JSON.stringify(info.extensions)}`);

  const sections = info.sections as Array<{ heading: string; body: string }> | undefined;
  if (sections) {
    const s = formatSections(sections);
    if (s) lines.push(s);
  }

  if (Object.keys(manifest).length > 0) {
    lines.push(`Manifest: ${JSON.stringify(manifest, null, 2)}`);
  }
  if (resourceDirs.length > 0) {
    lines.push(`Resource directories: ${resourceDirs.join(', ')}`);
  }
  lines.push(`License: ${info.hasLicense ? 'present' : 'absent'}`);
  lines.push(`Notice: ${info.hasNotice ? 'present' : 'absent'}`);

  if (diagnostics.length > 0) lines.push(formatDiagnostics(diagnostics));

  return { exitCode: hasErrors ? 1 : 0, output: lines.join('\n') };
}

function runAdapters(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  let manifests = registry.listAdapters();

  if (opts.format) {
    const fmt = opts.format;
    manifests = manifests.filter(
      (m) => m.supports.sourceFormats.includes(fmt) || m.supports.targetFormats.includes(fmt),
    );
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, manifests) };
  }

  return { exitCode: 0, output: formatAdapterTable(manifests, opts.detail) };
}

function runCapabilities(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  if (opts.adapter) {
    const manifests = registry.listAdapters();
    const found = manifests.find((m) => m.name === opts.adapter);
    if (!found) {
      const err: CliError = { code: 'CLI-016', message: `unknown adapter '${opts.adapter}'` };
      if (opts.json) return { exitCode: 1, output: jsonError(err) };
      return { exitCode: 1, output: formatError(err) };
    }

    if (opts.json) {
      return {
        exitCode: 0,
        output: jsonResult(true, { adapter: opts.adapter, capabilities: found.capabilities }),
      };
    }

    const lines: string[] = [`Capabilities for adapter '${opts.adapter}':`];
    for (const cap of found.capabilities) {
      lines.push(`  ${cap}`);
    }
    return { exitCode: 0, output: lines.join('\n') };
  }

  const knownCaps = Object.keys(CAPABILITY_VOCABULARY) as Capability[];
  const grouped: Record<string, Array<{ id: string; description: string }>> = {};

  for (const cap of knownCaps) {
    const def = CAPABILITY_VOCABULARY[cap];
    const cat = def.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ id: cap, description: def.description });
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, grouped) };
  }

  const lines: string[] = ['IR Capability Vocabulary:', ''];
  for (const [category, caps] of Object.entries(grouped)) {
    lines.push(`  ${category}:`);
    for (const c of caps) {
      lines.push(`    - ${c.id.padEnd(22)} ${c.description}`);
    }
    lines.push('');
  }
  return { exitCode: 0, output: lines.join('\n') };
}

function runDoctor(
  _opts: CliOptions,
  registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  const checks: Array<{ check: string; severity: string; status: string; message: string }> = [];

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (nodeMajor >= 20) {
    checks.push({
      check: 'node-version',
      severity: 'info',
      status: 'pass',
      message: `Node.js ${nodeVersion}`,
    });
  } else {
    checks.push({
      check: 'node-version',
      severity: 'warning',
      status: 'warn',
      message: `Node.js ${nodeVersion} — minimum recommended is 20.x`,
    });
  }

  // Platform info
  checks.push({
    check: 'platform',
    severity: 'info',
    status: 'pass',
    message: `OS: ${process.platform}, Arch: ${process.arch}, Host: ${hostname()}`,
  });

  // Adapter registrations
  const manifests = registry.listAdapters();
  checks.push({
    check: 'adapters',
    severity: 'info',
    status: 'pass',
    message: `${manifests.length} adapters registered`,
  });
  for (const m of manifests) {
    checks.push({
      check: `adapter:${m.name}`,
      severity: 'info',
      status: 'pass',
      message: `${m.name}@${m.version} (${m.vendor})`,
    });
  }

  // Environment (redacted)
  const envVars: Array<{ name: string; value: string }> = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      envVars.push({ name, value: isSecretEnvVar(name) ? '****' : value });
    }
  }
  envVars.sort((a, b) => a.name.localeCompare(b.name));
  checks.push({
    check: 'environment',
    severity: 'info',
    status: 'pass',
    message: `${envVars.length} env vars (secrets redacted)`,
  });

  if (_opts.json) {
    return { exitCode: 0, output: jsonResult(true, { checks }) };
  }

  const lines: string[] = ['SkillBridge Doctor — Local Environment Diagnostics', ''];
  for (const c of checks) {
    const icon = c.severity === 'warning' ? '!' : ' ';
    lines.push(`  [${icon}] ${c.check}: ${c.message}`);
  }

  return { exitCode: 0, output: lines.join('\n') };
}

async function runCliInstall(
  opts: CliOptions,
  registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const sourceArg = opts.args[0];
  if (!sourceArg) {
    const err: CliError = { code: 'CLI-020', message: 'missing file argument for install command' };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
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
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const from = opts.from || 'markdown';
  const sourceResult = registry.selectSourceAdapter(source, from, opts.sourceAdapter);
  if (!sourceResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message:
        sourceResult.error.find((d) => d.severity === 'error')?.message || 'no adapter found',
      diagnostics: sourceResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const adapter = sourceResult.value;
  const parsed = adapter.parse(source);
  const ctx = { source, normalized: parsed, manifest: adapter.manifest };

  const planResult = installPlan(adapter, ctx, {
    overwritePolicy: opts.force ? 'always' : 'never',
    baseDir: opts.args[1],
  });
  if (!planResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'install plan failed',
      diagnostics: planResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const plan = planResult.value;

  if (opts.dryRun) {
    return { exitCode: 0, output: formatDryRun({ plan, adapterName: adapter.manifest.name }) };
  }

  const execResult = execute({ adapter, context: ctx, plan, force: opts.force, action: 'install' });
  if (!execResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'install failed',
      diagnostics: execResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, execResult.value) };
  }
  return { exitCode: 0, output: `Installed: ${sourceArg}` };
}

async function runCliUninstall(
  opts: CliOptions,
  _registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const name = opts.args[0];
  if (!name) {
    const err: CliError = { code: 'CLI-020', message: 'missing skill name for uninstall command' };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const adapters = [adapterPortable, adapterClaude, adapterOpencode, adapterCodex];
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    const err: CliError = { code: 'CLI-021', message: `invalid skill name '${name}'` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }
  const dirs = adapters.map(() => `.agents/skills/${name}`);
  const listResult = listInstalled(adapters, dirs);

  if (!listResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'list failed',
      diagnostics: listResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const found = listResult.value.find((s) => s.name === name);
  if (!found) {
    const err: CliError = { code: 'CLI-021', message: `skill '${name}' not found` };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const adapter = _registry.get(found.adapterName);
  if (!adapter) {
    const err: CliError = {
      code: 'CLI-003',
      message: `adapter '${found.adapterName}' not registered`,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const plan: ResolvedInstallPlan = {
    steps: [`Uninstall ${name}`],
    scope: 'custom',
    destinationPaths: [found.path],
  };
  const ctx = { source: '', normalized: {}, manifest: adapter.manifest };

  const execResult = execute({
    adapter,
    context: ctx,
    plan,
    force: opts.force,
    action: 'uninstall',
  });
  if (!execResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'uninstall failed',
      diagnostics: execResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, execResult.value) };
  }
  return { exitCode: 0, output: `Uninstalled: ${name}` };
}

function runCliList(
  opts: CliOptions,
  _registry: LocalAdapterRegistry,
): { exitCode: ExitCode; output: string } {
  const adapters = [adapterPortable, adapterClaude, adapterOpencode, adapterCodex];
  const dirs = ['.agents/skills'];
  const listResult = listInstalled(adapters, dirs);

  if (!listResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'list failed',
      diagnostics: listResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, listResult.value) };
  }

  if (listResult.value.length === 0) {
    return { exitCode: 0, output: 'No installed skills found.' };
  }

  const header = 'Name'.padEnd(22) + 'Adapter'.padEnd(22) + 'Status'.padEnd(10) + 'Path';
  const sep = '-'.repeat(header.length);
  const rows = listResult.value.map(
    (s) => `${s.name.padEnd(22)}${s.adapterName.padEnd(22)}${s.status.padEnd(10)}${s.path}`,
  );
  return { exitCode: 0, output: [header, sep, ...rows].join('\n') };
}

async function runCliVerify(
  opts: CliOptions,
  _registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const _name = opts.args[0];
  const adapters = [adapterPortable, adapterClaude, adapterOpencode, adapterCodex];
  const dirs = ['.agents/skills'];
  const listResult = listInstalled(adapters, dirs);

  if (!listResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'list failed',
      diagnostics: listResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const filtered = _name ? listResult.value.filter((s) => s.name === _name) : listResult.value;
  if (filtered.length === 0) {
    const err: CliError = {
      code: 'CLI-021',
      message: _name ? `skill '${_name}' not found` : 'no installed skills',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, filtered) };
  }

  const lines = filtered.map((s) => `${s.name}: ${s.status}`);
  return { exitCode: 0, output: lines.join('\n') };
}

async function runCliRepair(
  opts: CliOptions,
  _registry: LocalAdapterRegistry,
): Promise<{ exitCode: ExitCode; output: string }> {
  const _name = opts.args[0];
  const adapters = [adapterPortable, adapterClaude, adapterOpencode, adapterCodex];
  const dirs = ['.agents/skills'];
  const listResult = listInstalled(adapters, dirs);

  if (!listResult.ok) {
    const err: CliError = {
      code: 'CLI-003',
      message: 'list failed',
      diagnostics: listResult.error,
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  const filtered = _name ? listResult.value.filter((s) => s.name === _name) : listResult.value;
  if (filtered.length === 0) {
    const err: CliError = {
      code: 'CLI-021',
      message: _name ? `skill '${_name}' not found` : 'no installed skills',
    };
    if (opts.json) return { exitCode: 1, output: jsonError(err) };
    return { exitCode: 1, output: formatError(err) };
  }

  if (opts.json) {
    return { exitCode: 0, output: jsonResult(true, { repaired: filtered.length }) };
  }
  return { exitCode: 0, output: `Repaired: ${filtered.map((s) => s.name).join(', ')}` };
}

export async function main(argv?: string[]): Promise<ExitCode> {
  const args = argv ?? process.argv;
  const { exitCode, output } = await run(args);
  if (output) {
    if (exitCode === 0) {
      console.log(output);
    } else {
      console.error(output);
    }
  }
  return exitCode;
}
