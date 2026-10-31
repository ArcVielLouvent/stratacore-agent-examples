# Per-PR preview environments with Docker Compose and Traefik

A reference setup where every pull request gets its own HTTPS hostname on one Linux server, and everything is removed when the PR closes. These are plain files you can copy; they do not depend on StrataCore.

```
pr-42.preview.example.com  ->  Traefik  ->  containers of project "pr-42"
```

## Contents

| Path | What it is |
| --- | --- |
| `traefik/docker-compose.yml` | Traefik with a wildcard certificate (Cloudflare DNS challenge). Run once per server. |
| `traefik/.env.example` | Variables for the Traefik stack. Copy to `.env`, never commit the real one. |
| `app/docker-compose.yml` | Sample app with per-PR labels. Replace the image and port with your own. |
| `scripts/deploy.sh` | Checks out a PR commit and runs `docker compose -p pr-<number> up -d --build`. |
| `scripts/teardown.sh` | Removes the project and its checkout when the PR closes. |
| `github-actions/preview.yml` | Workflow that calls the scripts over SSH. Copy it to `.github/workflows/` in your app repo. |

## Quick start

1. Add a DNS record `*.preview` pointing to your server (DNS only, not proxied).
2. Create a Cloudflare API token with DNS edit permission for the zone.
3. `docker network create web`, then in `traefik/`: copy `.env.example` to `.env`, set the token, replace `example.com` and the email in `docker-compose.yml`, and run `docker compose up -d`.
4. Copy `scripts/*.sh` to `/opt/previews/` on the server and `chmod +x` them. Set `PREVIEW_REPO` or edit the `REPO` line.
5. Add the labels from `app/docker-compose.yml` to your own compose file.
6. Add `VPS_HOST` and `VPS_SSH_KEY` as repository secrets and copy the workflow into your app repo.

## What is tested

Per-PR routing (two hostnames reach two different containers, and a removed container's route disappears) runs in CI: see `.github/workflows/test-preview-routing.yml` and start it from the Actions tab.

The wildcard certificate step needs a real domain and a public server, so CI does not cover it. It follows Traefik's documented DNS-challenge setup; try it on a throwaway server first.

## Security notes

- Previews are public by default. Add a basic-auth or IP-allowlist middleware before putting anything real behind them.
- A user who can run Docker is effectively root on that server. Use a dedicated machine.
- The workflow skips pull requests from forks on purpose.
- The scripts validate the PR number and commit SHA before using them. Keep that validation if you change them.

## License

MIT, same as the rest of this repository.
