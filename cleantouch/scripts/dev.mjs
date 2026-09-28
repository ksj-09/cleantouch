import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const viteEntry = join(projectDirectory, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [
  spawn(process.execPath, [join(projectDirectory, 'server', 'api.mjs')], { cwd: projectDirectory, stdio: 'inherit' }),
  spawn(process.execPath, [viteEntry, '--host', '127.0.0.1'], { cwd: projectDirectory, stdio: 'inherit' })
];

function stop() {
  for (const child of children) child.kill();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
}
