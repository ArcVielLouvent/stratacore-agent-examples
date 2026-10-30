// A polling agent skeleton. It claims jobs, runs a handler for each kind, and acknowledges the result.
// Handlers only log until DRY_RUN=false, so you can watch the protocol work before wiring in real actions.
import { pollJobs, ackJob } from './client.mjs';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const INTERVAL = Math.max(5, Number(process.env.POLL_INTERVAL) || 15) * 1000;

const act = async (what, fn) => {
  if (DRY_RUN) { console.log(`[dry-run] ${what}`); return { dryRun: true }; }
  return (await fn()) ?? { ok: true };
};

// Each handler receives the job payload. Replace the bodies with calls to your own infrastructure.
const handlers = {
  'preview.provision': (p) => act(`create preview environment for PR #${p.pr_number}`, async () => { /* docker compose up, helm install, ... */ }),
  'preview.wake':      (p) => act(`wake preview for PR #${p.pr_number}`, async () => {}),
  'preview.sleep':     (p) => act(`scale preview for PR #${p.pr_number} to zero`, async () => {}),
  'preview.destroy':   (p) => act(`destroy preview for PR #${p.pr_number}`, async () => {}),
  'deploy.rollback':   (p) => act(`roll back service ${p.service_id} to ${p.to_version}`, async () => {}),
  'drift.fix':         (p) => act(`re-apply declared config for service ${p.service_id}`, async () => {}),
  'service.rightsize': (p) => act(`set service ${p.service_id} to ${p.cpu} CPU / ${p.ram} GB`, async () => {}),
  'deploy.set_weight': (p) => act(`set canary weight of ${p.service} to ${p.weight}`, async () => {}),
};

async function tick() {
  const jobs = await pollJobs();
  // Jobs arrive in the order they were queued, so a sleep always runs before a destroy.
  for (const job of jobs) {
    const run = handlers[job.kind];
    if (!run) { await ackJob(job.id, 'failed', { error: `unsupported job kind: ${job.kind}` }); continue; }
    try {
      const result = await run(job.payload ?? {});
      await ackJob(job.id, 'done', result);
      console.log(`done   ${job.kind} ${job.id}`);
    } catch (e) {
      await ackJob(job.id, 'failed', { error: String(e?.message ?? e).slice(0, 500) });
      console.error(`failed ${job.kind} ${job.id}: ${e?.message ?? e}`);
    }
  }
}

let stop = false;
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { stop = true; });
console.log(`agent started (dry run: ${DRY_RUN}, interval: ${INTERVAL / 1000}s)`);
while (!stop) {
  try { await tick(); } catch (e) { console.error(`poll error: ${e.message}`); }
  await new Promise((r) => setTimeout(r, INTERVAL));
}
console.log('agent stopped');
