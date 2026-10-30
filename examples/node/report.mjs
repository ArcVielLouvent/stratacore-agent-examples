// Sends one telemetry report. The payload below is illustrative; field names match the protocol in docs/protocol.md.
import { report } from './client.mjs';

await report({
  services: [{
    name: 'checkout-api', status: 'healthy', language: 'TypeScript', owner_team: 'Payments',
    cpu_actual: 0.8, cpu_requested: 2, ram_actual_gb: 1.1, ram_requested_gb: 4,
    monthly_cost_usd: 96, latency_p95_ms: 180, uptime_pct: 99.95, version: 'v1.42.0',
  }],
  previews: [{ pr_number: 128, cpu_pct: 12, ram_mb: 640, active: true, status: 'Running', logs: ['ready'] }],
  tests: [{ service_name: 'checkout-api', pr_number: 128, kind: 'e2e', status: 'passed', passed: 42, failed: 0, duration_ms: 31200 }],
});
console.log('report accepted');
