import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { InitializationService } from '../initialization/initialization.service';

/**
 * InitCommand
 * 
 * CLI command for manual initialization of PinPoint India data and indexes.
 * 
 * This is the recommended approach for production:
 * - Run this command in a Kubernetes InitContainer
 * - Or as a separate Docker Compose init service
 * - Or manually before first deployment
 * 
 * The main application can then validate (not build) on startup.
 * 
 * Usage:
 *   npm run cli init                      # Idempotent initialization
 *   npm run cli init --force-reingest     # Force data re-download
 *   npm run cli init --force-rebuild      # Force H3 index rebuild
 *   npm run cli init --all                # Force both
 */
@Command({
  name: 'init',
  description: 'Initialize PinPoint India data and H3 spatial index',
})
export class InitCommand extends CommandRunner {
  private readonly logger = new Logger(InitCommand.name);

  constructor(private readonly initializationService: InitializationService) {
    super();
  }

  async run(
    passedParams: string[],
    options?: InitCommandOptions,
  ): Promise<void> {
    this.logger.log('🚀 Starting manual initialization...');

    const forceReingest = options?.forceReingest || options?.all || false;
    const forceRebuild = options?.forceRebuild || options?.all || false;

    try {
      await this.initializationService.forceReinitialize({
        forceReingest,
        forceRebuild,
      });

      this.logger.log('✅ Manual initialization complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('❌ Manual initialization failed:', error.stack);
      process.exit(1);
    }
  }

  @Option({
    flags: '--force-reingest',
    description: 'Force re-download and re-ingest pincode data',
  })
  parseForceReingest(): boolean {
    return true;
  }

  @Option({
    flags: '--force-rebuild',
    description: 'Force rebuild H3 spatial index',
  })
  parseForceRebuild(): boolean {
    return true;
  }

  @Option({
    flags: '--all',
    description: 'Force reingest AND rebuild',
  })
  parseAll(): boolean {
    return true;
  }
}

interface InitCommandOptions {
  forceReingest?: boolean;
  forceRebuild?: boolean;
  all?: boolean;
}
