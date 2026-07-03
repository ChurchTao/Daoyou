const api = Bun.spawn(['bun', 'scripts/dev-api.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
const web = Bun.spawn(['bunx', 'vite'], {
  stdout: 'inherit',
  stderr: 'inherit',
});

function stop() {
  api.kill();
  web.kill();
}

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});

const exitCode = await Promise.race([api.exited, web.exited]);
stop();
process.exit(exitCode);
