import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto, MfaCodeDto, RegisterDto, ResetPasswordDto } from './auth.dto.js';
import { LoginDto } from './login.dto.js';
import { UserRequest } from './user-session.guard.js';
import { OAuthService } from './oauth.service.js';
export declare class AuthController {
    private readonly authService;
    private readonly oauthService;
    constructor(authService: AuthService, oauthService: OAuthService);
    getStatus(): {
        module: string;
        status: string;
        message: string;
    };
    getOAuthProviders(): {
        google: boolean;
        apple: boolean;
        passwordReset: boolean;
    };
    startGoogleOAuth(response: Response): void;
    startAppleOAuth(response: Response): void;
    googleOAuthCallback(query: Record<string, unknown>, request: Request, response: Response): Promise<void>;
    appleOAuthCallback(body: Record<string, unknown>, request: Request, response: Response): Promise<void>;
    private startOAuth;
    private finishOAuth;
    register(body: RegisterDto): Promise<import("./auth.service.js").UserIdentity>;
    login(body: LoginDto, response: Response): Promise<import("./auth.service.js").UserIdentity | {
        mfaRequired: boolean;
    }>;
    verifyLoginMfa(body: MfaCodeDto, request: Request, response: Response): Promise<import("./auth.service.js").UserIdentity>;
    getCurrentUser(request: UserRequest): import("./auth.service.js").UserIdentity;
    getCurrentAdmin(request: Request & {
        admin: {
            id: string;
            email: string;
            role: 'ADMIN';
        };
    }): {
        id: string;
        email: string;
        role: "ADMIN";
    };
    forgotPassword(body: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(body: ResetPasswordDto, response: Response): Promise<{
        ok: boolean;
    }>;
    startMfaSetup(request: UserRequest): Promise<{
        secret: string;
        otpauthUrl: string;
    }>;
    enableMfa(request: UserRequest, body: MfaCodeDto): Promise<{
        enabled: boolean;
        backupCodes: string[];
    }>;
    disableMfa(request: UserRequest, body: MfaCodeDto): Promise<{
        enabled: boolean;
    }>;
    logout(request: Request, response: Response): Promise<{
        ok: boolean;
    }>;
}
