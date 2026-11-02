var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AdminSessionGuard } from './admin-session.guard.js';
import { AuthService } from './auth.service.js';
import { UserSessionGuard } from './user-session.guard.js';
import { MailerService } from './mailer.service.js';
import { OAuthService } from './oauth.service.js';
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Module({
        controllers: [AuthController],
        providers: [AuthService, AdminSessionGuard, UserSessionGuard, MailerService, OAuthService],
        exports: [AuthService, AdminSessionGuard, UserSessionGuard],
    })
], AuthModule);
export { AuthModule };
//# sourceMappingURL=auth.module.js.map