import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalAdapterRegistry } from '@skillbridge/registry-local';
import { ConversionPipeline } from '@skillbridge/conversion';
import type { PolicyMode, ConversionOptions } from '@skillbridge/conversion';
import adapterPortable from '@skillbridge/adapter-portable';
import adapterClaude from '@skillbridge/adapter-claude';
import adapterCodex from '@skillbridge/adapter-codex';
import adapterOpencode from '@skillbridge/adapter-opencode';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PLAYGROUND_PORT || '3071', 10);
const MAX_BODY = 512_000;

const registry = new LocalAdapterRegistry();
registry.register(adapterPortable);
registry.register(adapterClaude);
registry.register(adapterCodex);
registry.register(adapterOpencode);
const pipeline = new ConversionPipeline(registry);

const EXAMPLE_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'testing',
  'fixtures',
  'examples',
  'hello-world',
  'SKILL.md',
);
const EXAMPLE_SOURCE = readFileSync(EXAMPLE_PATH, 'utf-8');

interface ApiError {
  error: { code: string; message: string; details?: unknown[] };
}

function jsonError(code: string, message: string, details?: unknown[]): ApiError {
  return { error: { code, message, details } };
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk.toString('utf-8');
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    const GET_ROUTES = ['/api/health', '/api/adapters', '/api/policies', '/api/example'];
    const POST_ROUTES = ['/api/analyze', '/api/convert'];

    // Unknown routes always return 404 regardless of method.
    if (!GET_ROUTES.includes(path) && !POST_ROUTES.includes(path)) {
      sendJson(res, 404, jsonError('NOT_FOUND', `Route ${req.method} ${path} not found`));
      return;
    }

    // Known routes return 405 when the method does not match.
    if (GET_ROUTES.includes(path) && req.method !== 'GET') {
      sendJson(res, 405, jsonError('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`));
      return;
    }
    if (POST_ROUTES.includes(path) && req.method !== 'POST') {
      sendJson(res, 405, jsonError('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`));
      return;
    }

    if (path === '/api/health') {
      sendJson(res, 200, { status: 'ok', version: '0.1.0-alpha' });
      return;
    }

    if (path === '/api/adapters') {
      const manifests = registry.listAdapters();
      sendJson(res, 200, manifests);
      return;
    }

    if (path === '/api/policies') {
      sendJson(res, 200, {
        policies: [
          { id: 'strict', description: 'Block any capability gap or permission change' },
          {
            id: 'safe',
            description: 'Block permission changes, warn on capability gaps (default)',
          },
          { id: 'permissive', description: 'Allow all conversions with diagnostics' },
        ],
        default: 'safe',
      });
      return;
    }

    if (path === '/api/example') {
      sendJson(res, 200, { source: EXAMPLE_SOURCE, sourceAdapter: 'adapter-portable' });
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, jsonError('PAYLOAD_TOO_LARGE', 'Request body exceeds 512 KB limit'));
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, 400, jsonError('INVALID_JSON', 'Request body is not valid JSON'));
      return;
    }

    if (path === '/api/analyze') {
      const source = parsed.source as string | undefined;
      const sourceAdapterName = parsed.sourceAdapter as string | undefined;
      const targetAdapterName = parsed.targetAdapter as string | undefined;

      if (!source || typeof source !== 'string') {
        sendJson(res, 400, jsonError('MISSING_SOURCE', 'Source skill content is required'));
        return;
      }
      if (!sourceAdapterName || typeof sourceAdapterName !== 'string') {
        sendJson(res, 400, jsonError('MISSING_SOURCE_ADAPTER', 'Source adapter is required'));
        return;
      }
      if (!targetAdapterName || typeof targetAdapterName !== 'string') {
        sendJson(res, 400, jsonError('MISSING_TARGET_ADAPTER', 'Target adapter is required'));
        return;
      }

      const opts: ConversionOptions = {
        sourceAdapterName,
        targetAdapterName,
        policy: 'permissive',
      };

      const result = pipeline.run(source, 'markdown', 'markdown', opts);

      sendJson(res, result.ok ? 200 : 200, {
        ok: result.ok,
        diagnostics: result.ok ? result.value.diagnostics : result.error,
        compatibility: result.ok ? result.value.compatibility : null,
        securityImpact: result.ok ? result.value.securityImpact : null,
        provenance: result.ok ? result.value.provenance : null,
        policyResult: result.ok ? result.value.policyResult : null,
      });
      return;
    }

    if (path === '/api/convert') {
      const source = parsed.source as string | undefined;
      const sourceAdapterName = parsed.sourceAdapter as string | undefined;
      const targetAdapterName = parsed.targetAdapter as string | undefined;
      const policy = (parsed.policy as string) || 'safe';

      if (!source || typeof source !== 'string') {
        sendJson(res, 400, jsonError('MISSING_SOURCE', 'Source skill content is required'));
        return;
      }
      if (!sourceAdapterName || typeof sourceAdapterName !== 'string') {
        sendJson(res, 400, jsonError('MISSING_SOURCE_ADAPTER', 'Source adapter is required'));
        return;
      }
      if (!targetAdapterName || typeof targetAdapterName !== 'string') {
        sendJson(res, 400, jsonError('MISSING_TARGET_ADAPTER', 'Target adapter is required'));
        return;
      }
      if (!['strict', 'safe', 'permissive'].includes(policy)) {
        sendJson(res, 400, jsonError('INVALID_POLICY', `Unknown policy '${policy}'`));
        return;
      }

      const opts: ConversionOptions = {
        sourceAdapterName,
        targetAdapterName,
        policy: policy as PolicyMode,
      };

      const result = pipeline.run(source, 'markdown', 'markdown', opts);

      if (!result.ok) {
        sendJson(res, 200, {
          ok: false,
          diagnostics: result.error,
          output: null,
          compatibility: null,
          policyResult: null,
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        output: result.value.output,
        diagnostics: result.value.diagnostics,
        compatibility: result.value.compatibility,
        securityImpact: result.value.securityImpact,
        provenance: result.value.provenance,
        policyResult: result.value.policyResult,
        fieldProvenances: result.value.fieldProvenances,
      });
      return;
    }

    sendJson(res, 404, jsonError('NOT_FOUND', `Route ${req.method} ${path} not found`));
  } catch (err) {
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : `Internal server error: ${(err as Error).message}`;
    sendJson(res, 500, jsonError('INTERNAL_ERROR', message));
  }
}

const server = createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`SkillBridge Playground API running at http://127.0.0.1:${PORT}`);
});
