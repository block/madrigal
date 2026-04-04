/**
 * Dev server entry point.
 *
 * Starts a Hono HTTP server. In dev mode, proxies non-API requests
 * to Vite dev server for HMR.
 */

import { serve } from '@hono/node-server';
import { loadState } from './state.js';
import { createApp } from './server.js';

export interface DevServerOptions {
  baseDir: string;
  port?: number;
  open?: boolean;
}

export async function startDevServer(options: DevServerOptions): Promise<void> {
  const { baseDir, port = 4567, open = false } = options;

  // Load initial state
  const state = await loadState(baseDir);
  console.log(`Loaded ${state.units.length} knowledge unit(s)`);

  if (state.loadErrors.length > 0) {
    console.warn(`  ${state.loadErrors.length} load error(s)`);
  }
  if (!state.validation.valid) {
    console.warn(`  Config validation errors: ${state.validation.errors.length}`);
  }

  const app = createApp(baseDir);

  serve({ fetch: app.fetch, port }, (info) => {
    const url = `http://localhost:${info.port}`;
    console.log(`\nMadrigal dev server running at ${url}`);
    console.log(`  API:  ${url}/api/config`);
    console.log(`  UI:   ${url}\n`);

    if (open) {
      import('node:child_process').then(({ exec }) => {
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${url}`);
      });
    }
  });

  // Keep process alive
  await new Promise(() => {});
}
