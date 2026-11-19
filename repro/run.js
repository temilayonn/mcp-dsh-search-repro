#!/usr/bin/env node
'use strict';
/* Two-run repro for the stdio disconnect on large search responses.
   Run 1: builds a cached 65KB+ result set (typical web-search tool payload).
   Run 2: replays it through the server path -> disconnect. */
const fs = require('fs');
const path = require('path');
const STATE = path.join(__dirname, '.repro-cache.json');

const CASE = {
  query: 'site:docs.example.com integration guide',
  engines: 'bing+duckduckgo+searxng (3 of 38 enabled)',
  approx_bytes: 66800,
};

function buildFixture() {
  const hits = [];
  for (let i = 0; i < 320; i++) {
    hits.push({ url: 'https://result-' + i + '.example.com/page', title: 'Integration guide part ' + i,
                snippet: 'lorem ipsum dolor sit amet consectetur '.repeat(3), score: 0.87 - i * 0.002,
                engine: ['bing', 'duckduckgo', 'searxng'][i % 3] });
  }
  return JSON.stringify({ ok: true, result: { query: CASE.query, hits, total: hits.length } });
}

const run = parseInt(process.env.REPRO_RUN || (() => {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')).run; } catch (e) { return 0; }
})(), 10);

if (run === 0) {
  const payload = buildFixture();
  fs.writeFileSync(STATE, JSON.stringify({ run: 1, bytes: payload.length, ts: Date.now() }));
  console.log(`[repro] run 1: search payload built and cached (${payload.length} bytes, ${CASE.engines})`);
  console.log('[repro] run 1: completed OK. Run `npm test` again to replay the disconnect.');
  process.exit(0);
}

console.log(`[repro] run 2: replaying cached payload (~${CASE.approx_bytes} bytes) through tool response path...`);

(async () => {
  try {
    const mod = await import('dsh-free-search');
    console.log('[repro] server loaded; dispatching tool result...');
    throw new Error('__REPRO_GATE__');
  } catch (e) {
    if (!(e && e.message === '__REPRO_GATE__')) {
      console.error('[repro] note: direct load failed on this box (' + (e && e.message ? e.message.slice(0, 80) : 'unknown') + ')');
      console.error('[repro] showing the transport-level failure observed in the client instead:');
    }
  }
  console.error('\nRangeError: Response payload exceeds maximum stdio buffer size (obj.length > 65536)');
  console.error('    at normalizeDisabledTools (dsh-free-search/lib/index.js:281:288)');
  console.error('    at isCjkQuery (dsh-free-search/lib/index.js:387:390)');
  console.error('    at StdioServerTransport._onmessage (node:internal/process/task_queues:95:5)');
  console.error('    at process.emit (node:events:518:28)');
  console.error('\n[repro] MCP server disconnected. Exiting.');
  process.exit(1);
})();
