import { test, expect } from '@playwright/test';

const API = 'http://localhost:3071';

test.describe('Playground API', () => {
  test('health endpoint', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0-alpha');
  });

  test('adapters endpoint returns 4 adapters', async ({ request }) => {
    const res = await request.get(`${API}/api/adapters`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBe(4);
    expect(body[0].name).toBeTruthy();
    expect(body[0].version).toBe('0.1.0-alpha');
  });

  test('policies endpoint', async ({ request }) => {
    const res = await request.get(`${API}/api/policies`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.policies.length).toBe(3);
    expect(body.default).toBe('safe');
  });

  test('example endpoint', async ({ request }) => {
    const res = await request.get(`${API}/api/example`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.source).toContain('hello-world');
    expect(body.sourceAdapter).toBe('adapter-portable');
  });

  test('valid analysis', async ({ request }) => {
    const res = await request.post(`${API}/api/analyze`, {
      data: {
        source: '---\nname: test\n---\n\nBody',
        sourceAdapter: 'adapter-portable',
        targetAdapter: 'adapter-claude',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('diagnostics');
    expect(body).toHaveProperty('ok');
  });

  test('valid conversion with permissive policy', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      data: {
        source: '---\nname: test\n---\n\nBody',
        sourceAdapter: 'adapter-portable',
        targetAdapter: 'adapter-claude',
        policy: 'permissive',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('output');
  });

  test('malformed JSON returns 400', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      // Buffer sends the raw bytes; a plain string is JSON-wrapped by Playwright.
      data: Buffer.from('not json'),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_JSON');
  });

  test('missing source returns 400', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      data: { targetAdapter: 'adapter-claude', policy: 'safe' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('MISSING_SOURCE');
  });

  test('unknown adapter returns error', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      data: {
        source: '---\nname: t\n---',
        sourceAdapter: 'adapter-nonexistent',
        targetAdapter: 'adapter-claude',
        policy: 'permissive',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test('policy-blocked conversion', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      data: {
        // Declared permission the target drops -> safe policy blocks with CONV-010.
        source:
          '---\nname: test\ncapabilities:\n  - file-read\npermissions:\n  - resource: fs\n    actions:\n      - read\n---\nBody',
        sourceAdapter: 'adapter-portable',
        targetAdapter: 'adapter-portable',
        policy: 'safe',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(false);
    const codes = body.diagnostics.map((d: { code: string }) => d.code);
    expect(codes).toContain('CONV-010');
  });

  test('server does not return stack traces', async ({ request }) => {
    const res = await request.post(`${API}/api/convert`, {
      data: {
        source: '---\nname: test\n---\n\nB',
        sourceAdapter: 123,
        targetAdapter: 'adapter-claude',
        policy: 'safe',
      },
    });
    const text = await res.text();
    expect(text).not.toContain('Error:');
    expect(text).not.toContain('at ');
    expect(text).not.toContain('stack');
  });

  test('405 for wrong method', async ({ request }) => {
    const res = await request.post(`${API}/api/adapters`);
    expect(res.status()).toBe(405);
  });

  test('404 for unknown route', async ({ request }) => {
    const res = await request.get(`${API}/api/nonexistent`);
    expect(res.status()).toBe(404);
  });
});
