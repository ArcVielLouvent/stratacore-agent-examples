# StrataCore agent examples

Reference code for connecting your own infrastructure to [StrataCore](https://stratacore.dev), a platform that creates a preview environment for each pull request on servers you control. The examples show the agent protocol end to end: claiming jobs, acknowledging them, reporting telemetry and fetching secrets at deploy time.

This repository contains examples only. It does not contain the StrataCore application itself.

## Contents

| Path | What it shows |
| --- | --- |
| `examples/node/client.mjs` | A dependency-free client for the four agent endpoints (Node 18 or later). |
| `examples/node/agent.mjs` | A polling agent. Handlers log what they would do until `DRY_RUN=false`. |
| `examples/node/report.mjs` | Sending a telemetry report with services, previews and test results. |
| `examples/node/run-with-secrets.mjs` | Running a command with secrets injected into its environment only. |
| `examples/github-actions/report-tests.yml` | A workflow that reports end-to-end test results for each pull request. |
| `docs/protocol.md` | Endpoint reference, job kinds, telemetry shape and secret-handling guidance. |

## Quick start

```bash
git clone https://github.com/ArcVielLouvent/stratacore-agent-examples.git
cd stratacore-agent-examples/examples/node

export STRATACORE_AGENT_TOKEN="sc_live_..."   # created in the StrataCore console
node agent.mjs                                # dry run by default: it only logs
```

To see the protocol without a live account, point `STRATACORE_URL` at any server that implements the endpoints in `docs/protocol.md`.

## Design notes

- **Outbound only.** The agent polls the control plane over HTTPS. No inbound port needs to be opened on your servers.
- **Ordered jobs.** Jobs are returned oldest first, so a `preview.sleep` is always handled before a later `preview.destroy`.
- **Fail closed.** An unknown job kind is acknowledged as failed instead of being ignored, so the console shows it rather than leaving it running.
- **Least privilege.** Tokens are scoped. Only agents that deploy workloads need the `secrets` scope.
- **Safe by default.** Handlers do nothing but log until you set `DRY_RUN=false`.

## Limits

- The handlers are stubs. They show where to place your own provisioning logic (Docker Compose, Helm, systemd and so on) but do not provision anything.
- The GitHub Actions example reports one pass or fail result per run, not per-test counts. Adapt the `passed` and `failed` fields if your test runner exposes them.
- The protocol is described as implemented at the time of writing and may gain fields. Unknown fields are ignored by the server.

## Security

Never commit a token. Use `.env` files that stay local (they are ignored by this repository's `.gitignore`) or your CI provider's secret store. If a token is exposed, revoke it in the console.

## License

MIT. See [LICENSE](LICENSE).
