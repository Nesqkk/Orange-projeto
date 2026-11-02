import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AdminSessionGuard } from './admin-session.guard.js';
import { AuthService } from './auth.service.js';
import { UserSessionGuard } from './user-session.guard.js';
import { MailerService } from './mailer.service.js';
import { OAuthService } from './oauth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminSessionGuard, UserSessionGuard, MailerService, OAuthService],
  exports: [AuthService, AdminSessionGuard, UserSessionGuard],
})
export class AuthModule {}
