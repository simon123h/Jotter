// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Builds, previews and the unit tests read the shared parser from outside this project without trouble; only the dev
 * server refuses files it was not told about ("outside of Vite serving allow list"). So start it, for real.
 */
describe('dev server', () => {
  let server: ViteDevServer;
  let base: string;

  beforeAll(async () => {
    server = await createServer({
      root: process.cwd(),
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    });
    await server.listen();
    base = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('serves the app', async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
    expect((await fetch(`${base}/src/main.ts`)).status).toBe(200);
  });

  it('serves the shared parser package, and everything the parser imports', async () => {
    const parser = `/@fs${resolve(process.cwd(), '../packages/vault-format/src/markdownParser.ts')}`;
    const response = await fetch(`${base}${parser}`);
    expect(response.status).toBe(200);

    // The module as the browser gets it: follow each import it contains
    const code = await response.text();
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((url) => url.startsWith('/'));
    expect(imports.length).toBeGreaterThan(0);
    for (const url of imports) expect((await fetch(`${base}${url}`)).status, url).toBe(200);
  });

  it('still refuses files outside the project and the shared package', async () => {
    const outside = `/@fs${resolve(process.cwd(), '../pyproject.toml')}`;
    expect((await fetch(`${base}${outside}`)).status).toBe(403);
  });
});
