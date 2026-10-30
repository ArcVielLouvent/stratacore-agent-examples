// Minimal client for the StrataCore agent protocol. No dependencies, Node 18+.
const BASE = (process.env.STRATACORE_URL || 'https://stratacore.dev').replace(/\/+$/, '');
const TOKEN = process.env.STRATACORE_AGENT_TOKEN || '';

if (!TOKEN.startsWith('sc_live_')) {
  console.error('STRATACORE_AGENT_TOKEN is missing or malformed (expected the sc_live_ prefix).');
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.error ?? text.slice(0, 200)}`);
  return data;
}

/** Claims up to 10 pending jobs, oldest first. The agent only ever makes outbound requests. */
export const pollJobs = () => call('GET', '/api/agent/jobs').then((r) => r?.jobs ?? []);
/** Acknowledges a job. `status` is "done" or anything else for failure. */
export const ackJob = (id, status, result) => call('POST', `/api/agent/jobs/${encodeURIComponent(id)}`, { status, result });
/** Pushes telemetry: { services?, previews?, resources?, tests? }. */
export const report = (body) => call('POST', '/api/agent/report', body);
/** Returns { KEY: value } for one environment. Needs a token with the "secrets" scope. */
export const fetchSecrets = (env = 'production') => call('GET', `/api/agent/secrets?env=${encodeURIComponent(env)}`);
