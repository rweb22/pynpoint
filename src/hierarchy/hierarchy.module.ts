import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HierarchyController } from './controllers/hierarchy.controller';
import { HierarchyService } from './services/hierarchy.service';
import { AuthModule } from '../auth/auth.module';
import { ApiUsage } from '../database/entities/api-usage.entity';

/**
 * HierarchyModule
 *
 * Track 5: Hierarchy Operations
 *
 * Provides parent/child/ancestor navigation for H3 and DIGIPIN cells
 * using the h3-digipin library for accurate hierarchical relationships.
 *
 * Endpoints:
 * - H3 Hierarchy: parent, children, ancestors
 * - DIGIPIN Hierarchy: parent, children, ancestors
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage]),
    AuthModule,
  ],
  controllers: [HierarchyController],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
