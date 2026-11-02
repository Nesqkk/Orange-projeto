var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AdminSessionGuard } from './admin-session.guard.js';
import { AuthService, MFA_CHALLENGE_COOKIE_NAME, readMfaChallengeToken, SESSION_COOKIE_NAME } from './auth.service.js';
import { ForgotPasswordDto, MfaCodeDto, RegisterDto, ResetPasswordDto } from './auth.dto.js';
import { LoginDto } from './login.dto.js';
import { UserSessionGuard } from './user-session.guard.js';
import { OAuthService } from './oauth.service.js';
const OAUTH_STATE_COOKIE = {
    google: 'orange_oauth_google',
    apple: 'orange_oauth_apple',
};
function cookieValue(cookieHeader, name) {
    const prefix = `${name}=`;
    const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
    if (!value)
        return null;
    try {
        return decodeURIComponent(value);
    }
    catch {
        return null;
    }
}
function appleUser(value) {
    if (typeof value !== 'string')
        return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function stringValue(value) {
    return typeof value === 'string' ? value : '';
}
let AuthController = class AuthController {
    authService;
    oauthService;
    constructor(authService, oauthService) {
        this.authService = authService;
        this.oauthService = oauthService;
    }
    getStatus() {
        return { module: 'auth', status: 'ready', message: 'Authentication API is available.' };
    }
    getOAuthProviders() {
        return this.oauthService.getProviderStatus();
    }
    startGoogleOAuth(response) {
        return this.startOAuth('google', response);
    }
    startAppleOAuth(response) {
        return this.startOAuth('apple', response);
    }
    async googleOAuthCallback(query, request, response) {
        return this.finishOAuth('google', query, undefined, request, response);
    }
    async appleOAuthCallback(body, request, response) {
        return this.finishOAuth('apple', body, appleUser(body.user), request, response);
    }
    startOAuth(provider, response) {
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
    async finishOAuth(provider, responseBody, appleUserData, request, response) {
        const secure = process.env.NODE_ENV === 'production';
        const stateCookie = OAUTH_STATE_COOKIE[provider];
        response.clearCookie(stateCookie, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/' });
        const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
        const redirectToLogin = (reason = 'error') => response.redirect(`${frontendUrl}/login?oauth=${reason}`);
        const providerError = stringValue(responseBody.error);
        if (providerError)
            return redirectToLogin(providerError === 'access_denied' || providerError === 'user_cancelled_authorize' ? 'cancelled' : 'error');
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
            const login = await this.authService.loginWithOAuth(provider.toUpperCase(), identity);
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
        }
        catch {
            return redirectToLogin();
        }
    }
    register(body) {
        return this.authService.register(body.email, body.password, body.name);
    }
    async login(body, response) {
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
    async verifyLoginMfa(body, request, response) {
        const result = await this.authService.verifyMfaLogin(readMfaChallengeToken(request.headers.cookie), body.code);
        const secure = process.env.NODE_ENV === 'production';
        response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        response.cookie(SESSION_COOKIE_NAME, result.token, {
            httpOnly: true, secure, sameSite: 'lax', path: '/', expires: result.expiresAt,
        });
        return result.user;
    }
    getCurrentUser(request) {
        return request.user;
    }
    getCurrentAdmin(request) {
        return request.admin;
    }
    async forgotPassword(body) {
        await this.authService.requestPasswordReset(body.email);
        return { message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.' };
    }
    async resetPassword(body, response) {
        const result = await this.authService.resetPassword(body.token, body.password);
        const secure = process.env.NODE_ENV === 'production';
        response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        return result;
    }
    startMfaSetup(request) {
        return this.authService.startMfaSetup(request.user.id);
    }
    enableMfa(request, body) {
        return this.authService.enableMfa(request.user.id, body.code);
    }
    disableMfa(request, body) {
        return this.authService.disableMfa(request.user.id, body.code);
    }
    async logout(request, response) {
        await this.authService.logout(request.headers.cookie);
        const secure = process.env.NODE_ENV === 'production';
        response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        return { ok: true };
    }
};
__decorate([
    Get('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getStatus", null);
__decorate([
    Get('oauth/providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getOAuthProviders", null);
__decorate([
    Get('oauth/google'),
    Throttle({ default: { limit: 20, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "startGoogleOAuth", null);
__decorate([
    Get('oauth/apple'),
    Throttle({ default: { limit: 20, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "startAppleOAuth", null);
__decorate([
    Get('oauth/google/callback'),
    Throttle({ default: { limit: 20, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Query()),
    __param(1, Req()),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleOAuthCallback", null);
__decorate([
    Post('oauth/apple/callback'),
    Throttle({ default: { limit: 20, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __param(1, Req()),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "appleOAuthCallback", null);
__decorate([
    Post('register'),
    HttpCode(HttpStatus.CREATED),
    Throttle({ default: { limit: 5, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    Post('login'),
    HttpCode(HttpStatus.OK),
    Throttle({ default: { limit: 5, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Post('mfa/verify-login'),
    HttpCode(HttpStatus.OK),
    Throttle({ default: { limit: 5, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __param(1, Req()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MfaCodeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyLoginMfa", null);
__decorate([
    Get('me'),
    UseGuards(UserSessionGuard),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getCurrentUser", null);
__decorate([
    Get('admin/me'),
    UseGuards(AdminSessionGuard),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getCurrentAdmin", null);
__decorate([
    Post('password/forgot'),
    HttpCode(HttpStatus.OK),
    Throttle({ default: { limit: 3, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    Post('password/reset'),
    HttpCode(HttpStatus.OK),
    Throttle({ default: { limit: 5, ttl: 60_000 } }),
    UseGuards(ThrottlerGuard),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResetPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    Post('mfa/setup'),
    UseGuards(UserSessionGuard),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "startMfaSetup", null);
__decorate([
    Post('mfa/enable'),
    UseGuards(UserSessionGuard),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MfaCodeDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "enableMfa", null);
__decorate([
    Post('mfa/disable'),
    UseGuards(UserSessionGuard),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MfaCodeDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "disableMfa", null);
__decorate([
    Post('logout'),
    HttpCode(HttpStatus.OK),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
AuthController = __decorate([
    Controller('auth'),
    __metadata("design:paramtypes", [AuthService, OAuthService])
], AuthController);
export { AuthController };
//# sourceMappingURL=auth.controller.js.map