import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { PlansModule } from './plans/plans.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { SupportModule } from './support/support.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule,
    AuthModule,
    PlansModule,
    CustomersModule,
    SupportModule,
  ],
})
export class AppModule {}
