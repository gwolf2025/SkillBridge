import type {
  Adapter,
  AdapterManifest,
  ConversionContext,
  InstallPlan,
  Result,
  Diagnostic,
} from '@skillbridge/adapter-sdk';
import type { NormalizedSkill } from '@skillbridge/ir';

export interface InMemoryTestAdapterOptions {
  manifest: AdapterManifest;
  detectResult?: boolean;
  parsedValue?: unknown;
  compiledValue?: unknown;
  normalizedValue?: unknown;
  installPlan?: InstallPlan;
  installShouldFail?: boolean;
  uninstallShouldFail?: boolean;
  verifyResult?: boolean;
  invokeResult?: unknown;
  trackCalls?: boolean;
  rejectInputs?: unknown[];
}

export class InMemoryTestAdapter implements Adapter {
  manifest: AdapterManifest;
  detectResult: boolean;
  parsedValue: unknown;
  compiledValue: unknown;
  normalizedValue: unknown;
  installPlanValue: InstallPlan;
  installShouldFail: boolean;
  uninstallShouldFail: boolean;
  verifyResultValue: boolean;
  invokeResultValue: unknown;
  rejectInputs: unknown[];

  calls: string[] = [];
  lastContext?: ConversionContext;

  constructor(options: InMemoryTestAdapterOptions) {
    this.manifest = options.manifest;
    this.detectResult = options.detectResult ?? true;
    this.parsedValue = options.parsedValue ?? {};
    this.compiledValue = options.compiledValue ?? {};
    this.normalizedValue = options.normalizedValue ?? {};
    this.installPlanValue = options.installPlan ?? { steps: ['copy files', 'register hooks'] };
    this.installShouldFail = options.installShouldFail ?? false;
    this.uninstallShouldFail = options.uninstallShouldFail ?? false;
    this.verifyResultValue = options.verifyResult ?? true;
    this.invokeResultValue = options.invokeResult ?? {};
    this.rejectInputs = options.rejectInputs ?? [];
    if (options.trackCalls) {
      this.calls = [];
    }
  }

  detect(source: unknown): boolean {
    this.calls?.push('detect');
    if (this.rejectInputs.some((r) => r === source)) {
      return false;
    }
    return this.detectResult;
  }

  parse(_source: unknown): unknown {
    this.calls?.push('parse');
    return this.parsedValue;
  }

  normalize(_source: unknown, _parsed: unknown): NormalizedSkill {
    this.calls?.push('normalize');
    return this.normalizedValue as NormalizedSkill;
  }

  compile(_normalized: unknown): unknown {
    this.calls?.push('compile');
    return this.compiledValue;
  }

  installPlan(context: ConversionContext): InstallPlan {
    this.calls?.push('install-plan');
    this.lastContext = context;
    return this.installPlanValue;
  }

  install(context: ConversionContext): Result<void, Diagnostic[]> {
    this.calls?.push('install');
    this.lastContext = context;
    if (this.installShouldFail) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `adapter '${this.manifest.name}' installation failed`,
            code: 'ADAPTER-003',
            source: `adapter:${this.manifest.name}`,
          },
        ],
      };
    }
    return { ok: true, value: undefined };
  }

  uninstall(context: ConversionContext): Result<void, Diagnostic[]> {
    this.calls?.push('uninstall');
    this.lastContext = context;
    if (this.uninstallShouldFail) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `adapter '${this.manifest.name}' uninstallation failed`,
            code: 'ADAPTER-004',
            source: `adapter:${this.manifest.name}`,
          },
        ],
      };
    }
    return { ok: true, value: undefined };
  }

  verify(context: ConversionContext): Result<boolean, Diagnostic[]> {
    this.calls?.push('verify');
    this.lastContext = context;
    return { ok: true, value: this.verifyResultValue };
  }

  invoke(context: ConversionContext): Result<unknown, Diagnostic[]> {
    this.calls?.push('invoke');
    this.lastContext = context;
    return { ok: true, value: this.invokeResultValue };
  }

  reset(): void {
    this.calls = [];
    this.lastContext = undefined;
  }
}
