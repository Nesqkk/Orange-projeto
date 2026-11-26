import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, UserIdentity } from './auth.service.js';

export type UserRequest = Request & { user: UserIdentity };

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    (request as UserRequest).user = await this.authService.getUserFromCookie(request.headers.cookie);
    return true;
  }
}
