export {
  normalizePackageToIR,
  type NormalizationInput,
  type NormalizationResult,
  type FieldProvenance,
  type FieldSource,
} from './normalize.js';

export { ConversionPipeline } from './pipeline.js';
export type {
  ConversionProvenance,
  ConversionStep,
  ConversionResult,
  ConversionOptions,
  PolicyMode,
  PolicyDecision,
  PolicyResult,
} from './pipeline.js';
