// Runs a command with one environment's secrets injected into ITS environment only.
// Nothing is written to disk and nothing is printed.   Usage: node run-with-secrets.mjs production -- node server.js
import { spawn } from 'node:child_process';
import { fetchSecrets } from './client.mjs';

const args = process.argv.slice(2);
const split = args.indexOf('--');
if (split < 1 || split === args.length - 1) { console.error('usage: run-with-secrets.mjs <environment> -- <command> [args...]'); process.exit(2); }
const env = args[0];
const [cmd, ...rest] = args.slice(split + 1);

const secrets = await fetchSecrets(env);
const child = spawn(cmd, rest, { stdio: 'inherit', env: { ...process.env, ...secrets } });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
