import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module';

/**
 * CLI Entry Point
 * 
 * Bootstraps nest-commander CLI application.
 * 
 * Usage (add to package.json):
 * "scripts": {
 *   "cli": "ts-node -r tsconfig-paths/register src/cli/main.ts"
 * }
 * 
 * Commands:
 * npm run cli init
 * npm run cli init --force-reingest
 * npm run cli init --force-rebuild
 * npm run cli init --all
 */
async function bootstrap() {
  await CommandFactory.run(CliModule, ['warn', 'error', 'log']);
}

bootstrap();
