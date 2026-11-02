import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AdminSessionGuard } from './admin-session.guard.js';
import { AuthService, MFA_CHALLENGE_COOKIE_NAME, readMfaChallengeToken, SESSION_COOKIE_NAME } from './auth.service.js';
import { ForgotPasswordDto, MfaCodeDto, RegisterDto, ResetPasswordDto } from './auth.dto.js';
import { LoginDto } from './login.dto.js';
import { UserRequest, UserSessionGuard } from './user-session.guard.js';
import { OAuthService } from './oauth.service.js';
import type { OAuthProvider } from './oauth.service.js';

const OAUTH_STATE_COOKIE: Record<OAuthProvider, string> = {
  google: 'orange_oauth_google',
  apple: 'orange_oauth_apple',
};

function cookieValue(cookieHeader: string | undefined, name: string) {
  const prefix = `${name}=`;
  const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

function appleUser(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value) as { name?: { firstName?: string; lastName?: string }; email?: string };
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly oauthService: OAuthService) {}

  @Get('status')
  getStatus() {
    return { module: 'auth', status: 'ready', message: 'Authentication API is available.' };
  }

  @Get('oauth/providers')
  getOAuthProviders() {
    return this.oauthService.getProviderStatus();
  }

  @Get('oauth/google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  startGoogleOAuth(@Res() response: Response) {
    return this.startOAuth('google', response);
  }

  @Get('oauth/apple')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  startAppleOAuth(@Res() response: Response) {
    return this.startOAuth('apple', response);
  }

  @Get('oauth/google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async googleOAuthCallback(@Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    return this.finishOAuth('google', query, undefined, request, response);
  }

  @Post('oauth/apple/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async appleOAuthCallback(@Body() body: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    return this.finishOAuth('apple', body, appleUser(body.user), request, response);
  }

  private startOAuth(provider: OAuthProvider, response: Response) {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const verifier = provider === 'google' ? randomBytes(32).toString('base64url') : '';
    const challenge = verifier ? createHash('sha256').update(verifier).digest('base64url') : undefined;
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : 'lax';
    const authorizationUrl = this.oauthService.authorizationUrl(provider, state, nonce, challenge);
    response.cookie(OAUTH_STATE_COOKIE[provider], `${state}.${nonce}.${verifier}`, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    return response.redirect(authorizationUrl.href);
  }

  private async finishOAuth(
    provider: OAuthProvider,
    responseBody: Record<string, unknown>,
    appleUserData: ReturnType<typeof appleUser>,
    request: Request,
    response: Response,
  ) {
    const secure = process.env.NODE_ENV === 'production';
    const stateCookie = OAUTH_STATE_COOKIE[provider];
    response.clearCookie(stateCookie, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/' });
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const redirectToLogin = (reason: 'error' | 'cancelled' = 'error') => response.redirect(`${frontendUrl}/login?oauth=${reason}`);

    const providerError = stringValue(responseBody.error);
    if (providerError) return redirectToLogin(providerError === 'access_denied' || providerError === 'user_cancelled_authorize' ? 'cancelled' : 'error');

    const code = stringValue(responseBody.code);
    const state = stringValue(responseBody.state);
    const stored = cookieValue(request.headers.cookie, stateCookie)?.split('.') ?? [];
    const expectedState = stored[0] ?? '';
    const nonce = stored[1] ?? '';
    const stateBytes = Buffer.from(state);
    const expectedStateBytes = Buffer.from(expectedState);
    if (!code || !state || !nonce || stateBytes.length !== expectedStateBytes.length || !timingSafeEqual(stateBytes, expectedStateBytes)) {
      return redirectToLogin();
    }

    try {
      const identity = await this.oauthService.verifyCallback(provider, code, nonce, appleUserData, stored[2] || undefined);
      const login = await this.authService.loginWithOAuth(provider.toUpperCase() as 'GOOGLE' | 'APPLE', identity);
      await this.authService.logout(request.headers.cookie);
      response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
      if (login.mfaRequired) {
        response.cookie(MFA_CHALLENGE_COOKIE_NAME, login.challengeToken, {
          httpOnly: true, secure, sameSite: 'lax', path: '/', expires: login.expiresAt,
        });
        return response.redirect(`${frontendUrl}/login?mfa=1`);
      }

      response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
      response.cookie(SESSION_COOKIE_NAME, login.token, {
        httpOnly: true, secure, sameSite: 'lax', path: '/', expires: login.expiresAt,
      });
      return response.redirect(`${frontendUrl}/central-de-operacoes`);
    } catch {
      return redirectToLogin();
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body.email, body.password);
    const secure = process.env.NODE_ENV === 'production';
    if (result.mfaRequired) {
      response.cookie(MFA_CHALLENGE_COOKIE_NAME, result.challengeToken, {
        httpOnly: true, secure, sameSite: 'lax', path: '/', expires: result.expiresAt,
      });
      return { mfaRequired: true };
    }
    response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true, secure, sameSite: 'lax', path: '/', expires: result.expiresAt,
    });
    return result.user;
  }

  @Post('mfa/verify-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async verifyLoginMfa(@Body() body: MfaCodeDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.verifyMfaLogin(readMfaChallengeToken(request.headers.cookie), body.code);
    const secure = process.env.NODE_ENV === 'production';
    response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true, secure, sameSite: 'lax', path: '/', expires: result.expiresAt,
    });
    return result.user;
  }

  @Get('me')
  @UseGuards(UserSessionGuard)
  getCurrentUser(@Req() request: UserRequest) {
    return request.user;
  }

  @Get('admin/me')
  @UseGuards(AdminSessionGuard)
  getCurrentAdmin(@Req() request: Request & { admin: { id: string; email: string; role: 'ADMIN' } }) {
    return request.admin;
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(body.email);
    return { message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.' };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async resetPassword(@Body() body: ResetPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.resetPassword(body.token, body.password);
    const secure = process.env.NODE_ENV === 'production';
    response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    return result;
  }

  @Post('mfa/setup')
  @UseGuards(UserSessionGuard)
  startMfaSetup(@Req() request: UserRequest) {
    return this.authService.startMfaSetup(request.user.id);
  }

  @Post('mfa/enable')
  @UseGuards(UserSessionGuard)
  enableMfa(@Req() request: UserRequest, @Body() body: MfaCodeDto) {
    return this.authService.enableMfa(request.user.id, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(UserSessionGuard)
  disableMfa(@Req() request: UserRequest, @Body() body: MfaCodeDto) {
    return this.authService.disableMfa(request.user.id, body.code);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.headers.cookie);
    const secure = process.env.NODE_ENV === 'production';
    response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    return { ok: true };
  }
}
