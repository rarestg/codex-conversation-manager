#!/usr/bin/env node

import { execSync } from 'node:child_process';

const commands = ['tsc --noEmit', 'tsc --noEmit -p server/tsconfig.json'];

try {
  for (const command of commands) {
    execSync(command, { stdio: 'inherit' });
  }
} catch (error) {
  const exitCode = typeof error?.status === 'number' ? error.status : 1;
  process.exit(exitCode);
}
