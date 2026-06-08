import { execSync } from 'node:child_process';

const steps = [
  'npm run audit',
  'npm run simnet:fixture-proof',
  'npm test',
  'npm run lint',
  'npm run build',
];

for (const command of steps) {
  console.log(`\n> ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      shell: true,
    });
  } catch (error) {
    const status = typeof error.status === 'number' ? error.status : 1;
    console.error(`\n${command} failed with exit code ${status}.`);
    process.exit(status);
  }
}

console.log('\nAll verification checks passed.');
