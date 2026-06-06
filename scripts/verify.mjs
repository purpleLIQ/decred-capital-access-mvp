import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const steps = [
  ['audit'],
  ['test'],
  ['run', 'lint'],
  ['run', 'build'],
];

for (const args of steps) {
  const label = `npm ${args.join(' ')}`;
  console.log(`\n> ${label}`);
  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`\n${label} failed to start:`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll verification checks passed.');
