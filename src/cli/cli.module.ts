import { Module } from '@nestjs/common';
import { InitCommand } from './init.command';
import { InitializationModule } from '../initialization/initialization.module';

/**
 * CliModule
 * 
 * Provides CLI commands for manual/scheduled operations.
 * 
 * Uses nest-commander for command-line interface.
 * 
 * Commands:
 * - init: Initialize pincode data (manual trigger)
 * - validate: Validate system readiness
 * 
 * Usage (add to package.json):
 * "scripts": {
 *   "cli": "ts-node -r tsconfig-paths/register src/cli/main.ts"
 * }
 * 
 * Then run:
 * npm run cli init
 * npm run cli init --forceReingest
 * npm run cli rebuild-index
 */
@Module({
  imports: [InitializationModule],
  providers: [InitCommand],
})
export class CliModule {}
