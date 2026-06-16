import { Module } from '@nestjs/common';
import { HierarchyController } from './controllers/hierarchy.controller';
import { HierarchyService } from './services/hierarchy.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HierarchyController],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
