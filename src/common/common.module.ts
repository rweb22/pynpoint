import { Module, Global } from '@nestjs/common';
import { MemoryCacheService } from './services/memory-cache.service';

/**
 * CommonModule
 * 
 * Global module providing common services across the application.
 * 
 * Services:
 * - MemoryCacheService: In-memory L1 cache to reduce Redis dependency
 */
@Global()
@Module({
  providers: [MemoryCacheService],
  exports: [MemoryCacheService],
})
export class CommonModule {}
