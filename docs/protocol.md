# Agent protocol

The agent is outbound-only: it opens HTTPS connections to the control plane and never accepts inbound ones. Every request carries `Authorization: Bearer sc_live_...`. A token belongs to one organization and carries scopes; a request without a valid token receives `401`.

| Method and path | Purpose | Notes |
| --- | --- | --- |
| `GET /api/agent/jobs` | Claim pending jobs | Returns `{ "jobs": [{ "id", "kind", "payload" }] }`, at most 10, oldest first. Claimed jobs move to `running`. |
| `POST /api/agent/jobs/{id}` | Acknowledge a job | Body `{ "status": "done" \| "failed", "result": any }`. Any status other than `done` is recorded as failed. |
| `POST /api/agent/report` | Send telemetry | Body may contain `services`, `previews`, `resources`, `tests`. Unknown fields are ignored; arrays are capped (500 items, 200 for tests). |
| `GET /api/agent/secrets?env=production` | Fetch secrets for deploy-time injection | Requires the `secrets` scope, otherwise `403`. Response is `{ KEY: value }` with `Cache-Control: no-store`. |

## Job kinds

| Kind | Payload fields used | Effect on acknowledgement |
| --- | --- | --- |
| `preview.provision` | `pr_number` | `done` marks the preview Running, otherwise Failed. |
| `preview.wake` | `pr_number` | `done` marks it Running. |
| `preview.sleep` | `pr_number` | `done` marks it Sleeping. |
| `preview.destroy` | `pr_number` | `done` marks it Destroyed. |
| `deploy.rollback` | `deployment_id`, `service_id`, `to_version` | Updates the deployment and the service version. |
| `drift.fix` | `service_id` | Live configuration is recorded as matching the declared one. |
| `service.rightsize` | `service_id`, `cpu`, `ram`, `cost` | Requested resources and cost are updated. |
| `deploy.set_weight` | `service`, `weight`, `deployment_id` | Queued when a canary is aborted automatically; set the weight to the value given. |

## Telemetry shape

```jsonc
{
  "services":  [{ "name": "checkout-api", "status": "healthy", "cpu_actual": 0.8, "cpu_requested": 2,
                  "ram_actual_gb": 1.1, "ram_requested_gb": 4, "monthly_cost_usd": 96,
                  "latency_p95_ms": 180, "uptime_pct": 99.95, "version": "v1.42.0", "error_rate_pct": 0.3 }],
  "previews":  [{ "pr_number": 128, "cpu_pct": 12, "ram_mb": 640, "active": true, "status": "Running", "logs": ["ready"] }],
  "resources": [{ "name": "orders-db", "kind": "postgres", "provider": "aws", "status": "healthy", "size": "db.t4g.small", "is_public": false }],
  "tests":     [{ "service_name": "checkout-api", "pr_number": 128, "kind": "e2e", "status": "passed",
                  "passed": 42, "failed": 0, "duration_ms": 31200 }]
}
```

`status` for services is one of `healthy`, `warning`, `critical`, `unknown`. Test `kind` is `e2e`, `api` or `load`; test `status` is `passed`, `failed` or `running`. If `error_rate_pct` exceeds the organization's canary threshold while a canary deployment is in progress, the control plane aborts that canary and queues a `deploy.set_weight` job with weight 0.

## Handling secrets

- Request secrets only at deploy time and pass them to the child process environment, as `examples/node/run-with-secrets.mjs` does. Do not write them to disk or to logs.
- Use a token with the `secrets` scope only on machines that need it. Telemetry-only agents should not hold that scope.
- Revoke a token in the console as soon as it is exposed; revoked tokens stop working immediately.
