// Performance fixtures for benchmarking — no timing assertions in tests.
// These are large data structures for throughput measurement.

function buildDeepYaml(depth: number, breadth: number): Record<string, unknown> {
  if (depth <= 0) return { value: 'leaf' };
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < breadth; i++) {
    obj[`key${i}`] = buildDeepYaml(depth - 1, breadth);
  }
  return obj;
}

export const DEEP_YAML_FIXTURE: Record<string, unknown> = buildDeepYaml(12, 3);

export const DEEP_DIR_FIXTURE: string[] = [];
(function buildPaths(dir: string, depth: number): void {
  if (depth <= 0) return;
  const sub = `${dir}/sub`;
  DEEP_DIR_FIXTURE.push(sub);
  buildPaths(sub, depth - 1);
})('root', 28);
