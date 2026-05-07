import { execSync } from 'node:child_process';

const schemaPath = 'prisma/schema.prisma';
const failedMigration = '20260507161500_planned_load_targets';

function run(command, inherit = false) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe'
  });
}

let statusOutput = '';

try {
  statusOutput = run(`npx prisma migrate status --schema ${schemaPath}`);
} catch (error) {
  statusOutput = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
}

if (statusOutput.includes(failedMigration) && /failed/i.test(statusOutput)) {
  console.log(`Detected failed migration ${failedMigration}. Marking it as rolled back before deploy...`);
  run(`npx prisma migrate resolve --rolled-back ${failedMigration} --schema ${schemaPath}`, true);
}

run(`npx prisma migrate deploy --schema ${schemaPath}`, true);
