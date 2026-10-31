"""Polling agent for StrataCore, standard library only (Python 3.9+).

Claims jobs, runs a handler for each kind and acknowledges the result. Handlers only
log until DRY_RUN=false. Use --once to process a single batch and exit.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("STRATACORE_URL", "https://stratacore.dev").rstrip("/")
TOKEN = os.environ.get("STRATACORE_AGENT_TOKEN", "")
DRY_RUN = os.environ.get("DRY_RUN", "true") != "false"
INTERVAL = max(5, int(os.environ.get("POLL_INTERVAL", "15") or 15))

if not TOKEN.startswith("sc_live_"):
    sys.exit("STRATACORE_AGENT_TOKEN is missing or malformed (expected the sc_live_ prefix).")


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code} {e.read().decode()[:200]}") from None
    return json.loads(raw) if raw else None


def poll_jobs():
    return (call("GET", "/api/agent/jobs") or {}).get("jobs", [])


def ack_job(job_id, status, result=None):
    call("POST", f"/api/agent/jobs/{urllib.parse.quote(job_id, safe='')}", {"status": status, "result": result})


def act(what, fn):
    if DRY_RUN:
        print(f"[dry-run] {what}")
        return {"dryRun": True}
    return fn() or {"ok": True}


# Each handler receives the job payload. Replace the lambdas with calls to your own infrastructure.
HANDLERS = {
    "preview.provision": lambda p: act(f"create preview environment for PR #{p.get('pr_number')}", lambda: None),
    "preview.wake": lambda p: act(f"wake preview for PR #{p.get('pr_number')}", lambda: None),
    "preview.sleep": lambda p: act(f"scale preview for PR #{p.get('pr_number')} to zero", lambda: None),
    "preview.destroy": lambda p: act(f"destroy preview for PR #{p.get('pr_number')}", lambda: None),
    "deploy.rollback": lambda p: act(f"roll back service {p.get('service_id')} to {p.get('to_version')}", lambda: None),
    "drift.fix": lambda p: act(f"re-apply declared config for service {p.get('service_id')}", lambda: None),
    "service.rightsize": lambda p: act(f"set service {p.get('service_id')} to {p.get('cpu')} CPU / {p.get('ram')} GB", lambda: None),
    "deploy.set_weight": lambda p: act(f"set canary weight of {p.get('service')} to {p.get('weight')}", lambda: None),
}


def tick():
    # Jobs arrive in the order they were queued, so a sleep always runs before a destroy.
    for job in poll_jobs():
        run = HANDLERS.get(job["kind"])
        if run is None:
            ack_job(job["id"], "failed", {"error": f"unsupported job kind: {job['kind']}"})
            continue
        try:
            ack_job(job["id"], "done", run(job.get("payload") or {}))
            print(f"done   {job['kind']} {job['id']}")
        except Exception as e:  # report the failure instead of leaving the job running
            ack_job(job["id"], "failed", {"error": str(e)[:500]})
            print(f"failed {job['kind']} {job['id']}: {e}", file=sys.stderr)


if __name__ == "__main__":
    once = "--once" in sys.argv
    print(f"agent started (dry run: {DRY_RUN}, interval: {INTERVAL}s)")
    try:
        while True:
            try:
                tick()
            except Exception as e:
                print(f"poll error: {e}", file=sys.stderr)
            if once:
                break
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        pass
    print("agent stopped")
