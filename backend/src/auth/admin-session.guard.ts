import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminIdentity, AuthService } from './auth.service.js';

export type AdminRequest = Request & { admin: AdminIdentity };

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const admin = await this.authService.getAdminFromCookie(request.headers.cookie);
    (request as AdminRequest).admin = admin;
    return true;
  }
}
