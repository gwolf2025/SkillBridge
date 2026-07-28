import type { Result, Diagnostic, SourceLocation } from '../../core/src/index.js';
import type {
  PackageManifest,
  SkillPackageMeta,
  SkillPackageResourceDirs,
} from '../../ir/src/index.js';
export type ParserErrorCode =
  | 'PARSER-001'
  | 'PARSER-002'
  | 'PARSER-003'
  | 'PARSER-004'
  | 'PARSER-005'
  | 'PARSER-006'
  | 'PARSER-007'
  | 'PARSER-008'
  | 'PARSER-009'
  | 'PARSER-010'
  | 'PARSER-011'
  | 'PARSER-012';
export interface SkillMdSection {
  heading: string;
  body: string;
  location?: SourceLocation;
}
export interface SkillMdResult {
  frontmatter: Record<string, unknown>;
  sections: SkillMdSection[];
  extensions?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
}
export declare function parseSkillMd(
  content: string,
  file?: string,
): Result<SkillMdResult, Diagnostic[]>;
export interface SkillbridgeYamlResult {
  manifest: PackageManifest;
  diagnostics: Diagnostic[];
}
export declare function parseSkillbridgeYaml(
  content: string,
): Result<SkillbridgeYamlResult, Diagnostic[]>;
export declare function validatePackagePath(
  proposedPath: string,
  packageRoot: string,
): Result<string, Diagnostic[]>;
export declare function discoverResources(
  packagePath: string,
): Promise<Result<SkillPackageResourceDirs, Diagnostic[]>>;
export declare function loadPackage(path: string): Promise<Result<SkillPackageMeta, Diagnostic[]>>;
//# sourceMappingURL=index.d.ts.map
