export interface ToolCallRecord {
  tool: string;
  timestamp: string;
  args?: unknown;
}

export interface MockOutput {
  stdout: string;
  stderr: string;
  toolCalls: ToolCallRecord[];
  permissionRequests: Array<{ resource: string; actions: string[] }>;
  diagnostics: Array<{ severity?: string; message?: string; code?: string }>;
}

export function createMockEnvironment(_fixtureFiles: Record<string, string>): MockOutput {
  const toolCalls: ToolCallRecord[] = [];
  const permissionRequests: Array<{ resource: string; actions: string[] }> = [];
  const diagnostics: Array<{ severity?: string; message?: string; code?: string }> = [];

  diagnostics.push({ severity: 'info', message: 'mock environment initialized', code: 'MOCK-001' });

  return {
    stdout: '',
    stderr: '',
    toolCalls,
    permissionRequests,
    diagnostics,
  };
}

export function recordToolCall(env: MockOutput, tool: string, args?: unknown): void {
  env.toolCalls.push({ tool, timestamp: new Date().toISOString(), args });
}

export function recordPermissionRequest(
  env: MockOutput,
  resource: string,
  actions: string[],
): void {
  env.permissionRequests.push({ resource, actions });
}

export function appendOutput(env: MockOutput, stream: 'stdout' | 'stderr', text: string): void {
  if (stream === 'stdout') {
    env.stdout += text;
  } else {
    env.stderr += text;
  }
}
