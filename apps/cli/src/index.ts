#!/usr/bin/env node

/**
 * @skillbridge/cli
 *
 * SkillBridge command-line application.
 * No core business logic that cannot be reused through packages.
 */

import { main } from './cli.js';

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
