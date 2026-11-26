<?php

declare(strict_types=1);

function orange_token_hash(string $token): string
{
    return hash('sha256', $token);
}

function orange_random_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function orange_verification_resend_allowed(?string $lastSentAt, int $now): bool
{
    return $lastSentAt === null || orange_timestamp($lastSentAt) <= $now - 60;
}

function orange_auth_rate(string $route, int $limit): void
{
    orange_rate_limit('auth:' . $route, $limit, 60);
}

function orange_get_user_by_email(string $email): ?array
{
    $statement = orange_db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

function orange_create_mfa_challenge(array $user): array
{
    $token = orange_random_token();
    $expires = time() + 5 * 60;
    $db = orange_db();
    $delete = $db->prepare('DELETE FROM auth_challenges WHERE userId = ?');
    $delete->execute([$user['id']]);
    $insert = $db->prepare(
        'INSERT INTO auth_challenges (id, tokenHash, userId, expiresAt) VALUES (?, ?, ?, ?)',
    );
    $insert->execute([
        orange_uuid(),
        orange_token_hash($token),
        $user['id'],
        gmdate('Y-m-d H:i:s', $expires),
    ]);
    orange_set_cookie('orange_mfa_challenge', $token, $expires);
    return ['mfaRequired' => true];
}

function orange_register(array $body): never
{
    orange_auth_rate('register', 5);
    $email = strtolower(orange_string($body, 'email'));
    $name = orange_string($body, 'name');
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if (!orange_validate_email($email)) {
        orange_fail(400, 'Informe um endereço de e-mail válido.');
    }
    if (isset($body['name']) && (!is_string($body['name']) || orange_text_length($name) < 2 || orange_text_length($name) > 120)) {
        orange_fail(400, 'O nome precisa ter entre 2 e 120 caracteres.');
    }
    if (!orange_validate_password($password)) {
        orange_fail(400, 'A senha precisa ter entre 12 e 128 caracteres.');
    }
    if (!orange_smtp_configured()) {
        orange_fail(503, 'O envio de e-mail ainda não está configurado. Tente novamente mais tarde.');
    }

    $db = orange_db();
    $userId = orange_uuid();
    $token = orange_random_token();
    $now = orange_now();
    try {
        $db->beginTransaction();
        $insertUser = $db->prepare(
            'INSERT INTO users (id, email, name, passwordHash, role, emailVerified, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, \'CUSTOMER\', false, ?, ?)',
        );
        $insertUser->execute([
            $userId,
            $email,
            $name === '' ? null : $name,
            orange_hash_password($password),
            $now,
            $now,
        ]);
        $insertToken = $db->prepare(
            'INSERT INTO email_verification_tokens (id, tokenHash, userId, expiresAt)
             VALUES (?, ?, ?, ?)',
        );
        $insertToken->execute([
            orange_uuid(),
            orange_token_hash($token),
            $userId,
            gmdate('Y-m-d H:i:s', time() + 24 * 60 * 60),
        ]);
        $site = orange_origin();
        try {
            orange_send_verification($email, $name, $site . '/confirmar-email?token=' . rawurlencode($token));
        } catch (OrangeApiError $mailError) {
            throw $mailError;
        } catch (Throwable $mailError) {
            // O motivo vai para o log do servidor (resposta do SMTP, sem senha); o cliente recebe um aviso claro.
            error_log('Orange register: e-mail de confirmação não enviado: ' . $mailError->getMessage());
            throw new OrangeApiError(503, 'Não conseguimos enviar o e-mail de confirmação agora. Tente novamente em alguns minutos.');
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            orange_fail(409, 'Já existe uma conta com este e-mail.');
        }
        throw $error;
    }
    orange_json(201, ['emailVerificationRequired' => true]);
}

function orange_verify_email(array $body): never
{
    orange_auth_rate('email-verify', 10);
    $token = orange_string($body, 'token');
    if (strlen($token) < 32 || strlen($token) > 128) {
        orange_fail(400, 'Link de confirmação inválido ou expirado.');
    }
    $db = orange_db();
    $db->beginTransaction();
    try {
        $statement = $db->prepare(
            'SELECT id, userId FROM email_verification_tokens
             WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ? LIMIT 1',
        );
        $statement->execute([orange_token_hash($token), orange_now()]);
        $record = $statement->fetch();
        if (!$record) {
            orange_fail(401, 'Link de confirmação inválido ou expirado.');
        }
        $userLock = $db->prepare('SELECT id, email FROM users WHERE id = ? LIMIT 1 FOR UPDATE');
        $userLock->execute([$record['userId']]);
        $user = $userLock->fetch();
        if (!is_array($user)) {
            orange_fail(401, 'Link de confirmação inválido ou expirado.');
        }
        $updateToken = $db->prepare(
            'UPDATE email_verification_tokens SET usedAt = ? WHERE id = ? AND usedAt IS NULL AND expiresAt > ?',
        );
        $now = orange_now();
        $updateToken->execute([$now, $record['id'], $now]);
        if ($updateToken->rowCount() !== 1) {
            orange_fail(401, 'Link de confirmação inválido ou expirado.');
        }
        $updateUser = $db->prepare('UPDATE users SET emailVerified = true, updatedAt = ? WHERE id = ?');
        $updateUser->execute([$now, $record['userId']]);
        $email = strtolower((string) $user['email']);
        $unsubscribeCheck = $db->prepare('SELECT 1 FROM email_unsubscribes WHERE email = ? LIMIT 1');
        $unsubscribeCheck->execute([$email]);
        $welcomeEmailEligible = !$unsubscribeCheck->fetchColumn();
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    $welcomeEmailSent = null;
    if ($welcomeEmailEligible) {
        try {
            orange_send_welcome_email($email, orange_unsubscribe_url($email));
            $welcomeEmailSent = true;
        } catch (Throwable $error) {
            error_log('Orange welcome email delivery failed: ' . get_class($error));
            $welcomeEmailSent = false;
        }
    }
    orange_json(200, ['ok' => true, 'welcomeEmailSent' => $welcomeEmailSent]);
}

function orange_resend_verification(array $body): never
{
    orange_auth_rate('email-resend', 3);
    $email = strtolower(orange_string($body, 'email'));
    if (!orange_validate_email($email)) {
        orange_fail(400, 'Informe um endereço de e-mail válido.');
    }
    if (!orange_smtp_configured()) {
        orange_fail(503, 'O envio de e-mail ainda não está configurado. Tente novamente mais tarde.');
    }

    $db = orange_db();
    $db->beginTransaction();
    try {
        $lookup = $db->prepare(
            'SELECT id, email, name, emailVerified FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
        );
        $lookup->execute([$email]);
        $user = $lookup->fetch();
        if (is_array($user) && (int) $user['emailVerified'] !== 1) {
            $latestToken = $db->prepare(
                'SELECT createdAt FROM email_verification_tokens WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
            );
            $latestToken->execute([$user['id']]);
            $lastSentAt = $latestToken->fetchColumn();
            $lastSentAt = is_string($lastSentAt) ? $lastSentAt : null;

            if (orange_verification_resend_allowed($lastSentAt, time())) {
                $delete = $db->prepare('DELETE FROM email_verification_tokens WHERE userId = ? AND usedAt IS NULL');
                $delete->execute([$user['id']]);
                $token = orange_random_token();
                $insert = $db->prepare(
                    'INSERT INTO email_verification_tokens (id, tokenHash, userId, expiresAt)
                     VALUES (?, ?, ?, ?)',
                );
                $insert->execute([
                    orange_uuid(),
                    orange_token_hash($token),
                    $user['id'],
                    gmdate('Y-m-d H:i:s', time() + 24 * 60 * 60),
                ]);
                $name = is_string($user['name'] ?? null) ? $user['name'] : '';
                $site = orange_origin();
                orange_send_verification(
                    $email,
                    $name,
                    $site . '/confirmar-email?token=' . rawurlencode($token),
                );
            }
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }

    orange_json(200, [
        'message' => 'Se a conta ainda precisar de confirmação, enviaremos um novo link. Se acabou de solicitar, aguarde um minuto antes de tentar novamente.',
    ]);
}

function orange_login(array $body): never
{
    orange_auth_rate('login', 5);
    $email = strtolower(orange_string($body, 'email'));
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if (!orange_validate_email($email) || !orange_validate_password($password)) {
        orange_fail(400, 'Informe um e-mail e uma senha válidos.');
    }
    $user = orange_get_user_by_email($email);
    if (!$user) {
        password_verify($password, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT));
        orange_fail(401, 'E-mail ou senha inválidos.');
    }
    if (!password_verify($password, (string) $user['passwordHash'])) {
        orange_fail(401, 'E-mail ou senha inválidos.');
    }
    if ((int) $user['emailVerified'] !== 1) {
        orange_fail(403, 'Confirme seu e-mail pelo link enviado antes de entrar.');
    }
    if ((bool) $user['mfaEnabled']) {
        orange_json(200, orange_create_mfa_challenge($user));
    }
    orange_json(200, orange_create_session($user));
}

function orange_verify_mfa_login(array $body): never
{
    orange_auth_rate('mfa-login', 5);
    $token = orange_cookie('orange_mfa_challenge');
    $code = orange_string($body, 'code');
    if (orange_text_length($code) < 6 || orange_text_length($code) > 32) {
        orange_fail(400, 'Código MFA inválido.');
    }
    if ($token === null) {
        orange_fail(401, 'Desafio MFA ausente ou expirado.');
    }
    $db = orange_db();
    $statement = $db->prepare(
        'SELECT c.id AS challengeId, c.expiresAt, u.*
         FROM auth_challenges c JOIN users u ON u.id = c.userId
         WHERE c.tokenHash = ? LIMIT 1',
    );
    $statement->execute([orange_token_hash($token)]);
    $user = $statement->fetch();
    if (!$user || orange_timestamp((string) $user['expiresAt']) <= time() || !(bool) $user['mfaEnabled']) {
        if ($user) {
            $delete = $db->prepare('DELETE FROM auth_challenges WHERE id = ?');
            $delete->execute([$user['challengeId']]);
        }
        orange_clear_cookie('orange_mfa_challenge');
        orange_fail(401, 'Desafio MFA ausente ou expirado.');
    }
    if (!orange_verify_mfa($user, $code, true)) {
        orange_fail(401, 'Código MFA inválido.');
    }
    $delete = $db->prepare('DELETE FROM auth_challenges WHERE id = ? AND expiresAt > ?');
    $delete->execute([$user['challengeId'], orange_now()]);
    if ($delete->rowCount() !== 1) {
        orange_fail(401, 'Desafio MFA já utilizado ou expirado.');
    }
    orange_json(200, orange_create_session($user));
}

function orange_forgot_password(array $body): never
{
    orange_auth_rate('forgot-password', 3);
    $email = strtolower(orange_string($body, 'email'));
    if (!orange_validate_email($email)) {
        orange_fail(400, 'Informe um endereço de e-mail válido.');
    }
    if (orange_smtp_configured()) {
        $user = orange_get_user_by_email($email);
        if ($user) {
            $db = orange_db();
            $delete = $db->prepare('DELETE FROM password_reset_tokens WHERE userId = ? AND usedAt IS NULL');
            $delete->execute([$user['id']]);
            $token = orange_random_token();
            $insert = $db->prepare(
                'INSERT INTO password_reset_tokens (id, tokenHash, userId, expiresAt) VALUES (?, ?, ?, ?)',
            );
            $insert->execute([
                orange_uuid(),
                orange_token_hash($token),
                $user['id'],
                gmdate('Y-m-d H:i:s', time() + 30 * 60),
            ]);
            $site = orange_origin();
            try {
                $name = is_string($user['name'] ?? null) ? $user['name'] : '';
                orange_send_password_reset($email, $name, $site . '/redefinir-senha?token=' . rawurlencode($token));
            } catch (Throwable $error) {
                $remove = $db->prepare('DELETE FROM password_reset_tokens WHERE tokenHash = ?');
                $remove->execute([orange_token_hash($token)]);
                throw $error;
            }
        }
    }
    orange_json(200, ['message' => 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.']);
}

function orange_reset_password(array $body): never
{
    orange_auth_rate('reset-password', 5);
    $token = orange_string($body, 'token');
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if (strlen($token) < 32 || strlen($token) > 128 || !orange_validate_password($password)) {
        orange_fail(400, 'Link inválido ou senha fora dos requisitos.');
    }
    $db = orange_db();
    $db->beginTransaction();
    try {
        $statement = $db->prepare(
            'SELECT id, userId FROM password_reset_tokens
             WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ? LIMIT 1',
        );
        $statement->execute([orange_token_hash($token), orange_now()]);
        $record = $statement->fetch();
        if (!$record) {
            orange_fail(401, 'Link inválido ou expirado.');
        }
        $now = orange_now();
        $consume = $db->prepare(
            'UPDATE password_reset_tokens SET usedAt = ? WHERE id = ? AND usedAt IS NULL AND expiresAt > ?',
        );
        $consume->execute([$now, $record['id'], $now]);
        if ($consume->rowCount() !== 1) {
            orange_fail(401, 'Link inválido ou expirado.');
        }
        $update = $db->prepare('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?');
        $update->execute([orange_hash_password($password), $now, $record['userId']]);
        foreach (['auth_sessions', 'auth_challenges'] as $table) {
            $delete = $db->prepare("DELETE FROM {$table} WHERE userId = ?");
            $delete->execute([$record['userId']]);
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    orange_clear_cookie('orange_session');
    orange_clear_cookie('orange_mfa_challenge');
    orange_json(200, ['ok' => true]);
}

function orange_start_mfa_setup(array $user): never
{
    if ((bool) $user['mfaEnabled']) {
        orange_fail(409, 'MFA já está ativado nesta conta.');
    }
    $secret = orange_create_totp_secret();
    $encrypted = orange_encrypt_mfa($secret);
    $update = orange_db()->prepare('UPDATE users SET mfaPendingSecret = ?, updatedAt = ? WHERE id = ?');
    $update->execute([$encrypted, orange_now(), $user['id']]);
    $label = rawurlencode('Orange:' . $user['email']);
    $issuer = rawurlencode('Orange');
    orange_json(201, [
        'secret' => $secret,
        'otpauthUrl' => "otpauth://totp/{$label}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30",
    ]);
}

function orange_enable_mfa(array $user, array $body): never
{
    $code = orange_string($body, 'code');
    if (orange_text_length($code) < 6 || orange_text_length($code) > 32) {
        orange_fail(400, 'Código MFA inválido.');
    }
    $statement = orange_db()->prepare('SELECT mfaPendingSecret FROM users WHERE id = ?');
    $statement->execute([$user['id']]);
    $pending = $statement->fetchColumn();
    if (!is_string($pending) || $pending === '') {
        orange_fail(409, 'Inicie a configuração MFA antes de confirmar.');
    }
    $secret = orange_decrypt_mfa($pending);
    if (!orange_verify_totp($secret, $code)) {
        orange_fail(401, 'Código MFA inválido.');
    }
    $backupCodes = [];
    $hashes = [];
    for ($index = 0; $index < 8; $index++) {
        $backup = strtoupper(bin2hex(random_bytes(6)));
        $code = substr($backup, 0, 6) . '-' . substr($backup, 6);
        $backupCodes[] = $code;
        $hashes[] = hash('sha256', orange_normalize_backup_code($code));
    }
    $update = orange_db()->prepare(
        'UPDATE users SET mfaEnabled = true, mfaSecret = ?, mfaPendingSecret = NULL, mfaBackupCodes = ?, updatedAt = ? WHERE id = ?',
    );
    $update->execute([
        orange_encrypt_mfa($secret),
        json_encode($hashes, JSON_THROW_ON_ERROR),
        orange_now(),
        $user['id'],
    ]);
    orange_json(200, ['enabled' => true, 'backupCodes' => $backupCodes]);
}

function orange_disable_mfa(array $user, array $body): never
{
    $code = orange_string($body, 'code');
    if (orange_text_length($code) < 6 || orange_text_length($code) > 32) {
        orange_fail(400, 'Código MFA inválido.');
    }
    $statement = orange_db()->prepare('SELECT * FROM users WHERE id = ?');
    $statement->execute([$user['id']]);
    $record = $statement->fetch();
    if (!$record || !(bool) $record['mfaEnabled'] || empty($record['mfaSecret'])) {
        orange_fail(409, 'MFA não está ativado.');
    }
    if (!orange_verify_mfa($record, $code, true)) {
        orange_fail(401, 'Código MFA inválido.');
    }
    $db = orange_db();
    $db->beginTransaction();
    try {
        $update = $db->prepare(
            'UPDATE users SET mfaEnabled = false, mfaSecret = NULL, mfaPendingSecret = NULL, mfaBackupCodes = NULL, updatedAt = ? WHERE id = ?',
        );
        $update->execute([orange_now(), $user['id']]);
        $delete = $db->prepare('DELETE FROM auth_challenges WHERE userId = ?');
        $delete->execute([$user['id']]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    orange_json(200, ['enabled' => false]);
}

function orange_auth_route(string $method, string $path): bool
{
    if ($method === 'GET' && $path === '/api/auth/status') {
        orange_json(200, ['module' => 'auth', 'status' => 'ready', 'message' => 'Authentication API is available.']);
    }
    if ($method === 'GET' && $path === '/api/auth/oauth/providers') {
        orange_json(200, [
            'google' => orange_google_configured(),
            'apple' => false,
            'passwordReset' => orange_smtp_configured(),
        ]);
    }
    if ($method === 'GET' && $path === '/api/auth/oauth/google') {
        orange_auth_rate('oauth', 20);
        orange_google_start();
    }
    if ($method === 'GET' && $path === '/api/auth/oauth/google/callback') {
        orange_auth_rate('oauth', 20);
        orange_google_callback();
    }
    if (preg_match('#^/api/auth/oauth/apple(?:/callback)?$#', $path) === 1) {
        orange_auth_rate('oauth', 20);
        orange_fail(503, 'O login com Apple ainda não está habilitado.');
    }
    if ($method === 'POST' && $path === '/api/auth/register') {
        orange_register(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/email/verify') {
        orange_verify_email(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/email/resend') {
        orange_resend_verification(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/login') {
        orange_login(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/mfa/verify-login') {
        orange_verify_mfa_login(orange_body());
    }
    if ($method === 'GET' && $path === '/api/auth/me') {
        orange_json(200, orange_identity(orange_auth_user()));
    }
    if ($method === 'GET' && $path === '/api/auth/admin/me') {
        $user = orange_auth_user(true);
        orange_json(200, ['id' => $user['id'], 'email' => $user['email'], 'role' => 'ADMIN']);
    }
    if ($method === 'POST' && $path === '/api/auth/password/forgot') {
        orange_forgot_password(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/password/reset') {
        orange_reset_password(orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/mfa/setup') {
        orange_start_mfa_setup(orange_auth_user());
    }
    if ($method === 'POST' && $path === '/api/auth/mfa/enable') {
        orange_enable_mfa(orange_auth_user(), orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/mfa/disable') {
        orange_disable_mfa(orange_auth_user(), orange_body());
    }
    if ($method === 'POST' && $path === '/api/auth/logout') {
        $session = orange_cookie('orange_session');
        $challenge = orange_cookie('orange_mfa_challenge');
        if ($session !== null) {
            $delete = orange_db()->prepare('DELETE FROM auth_sessions WHERE tokenHash = ?');
            $delete->execute([orange_token_hash($session)]);
        }
        if ($challenge !== null) {
            $delete = orange_db()->prepare('DELETE FROM auth_challenges WHERE tokenHash = ?');
            $delete->execute([orange_token_hash($challenge)]);
        }
        orange_clear_cookie('orange_session');
        orange_clear_cookie('orange_mfa_challenge');
        orange_json(200, ['ok' => true]);
    }
    return false;
}
