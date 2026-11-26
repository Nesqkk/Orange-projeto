import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SupportController, OperationsController } from './support.controller.js';
import { SupportService } from './support.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SupportController, OperationsController],
  providers: [SupportService],
})
export class SupportModule {}
