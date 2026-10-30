// Runs the websocket server (dev mode, no static files) and Vite together.
import { spawn } from 'node:child_process';
const procs = [
  spawn(process.execPath, ['server/index.js', '--dev'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.GL_WS_PORT || '8091' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
