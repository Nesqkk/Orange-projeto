<?php

declare(strict_types=1);

// Login com Google (OpenID Connect, fluxo authorization code + PKCE).
// Configuração no orange-config.php: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e, se a API não
// estiver em https://api-app.bebaorange.com, API_URL. No Google Cloud, cadastre o URI de
// redirecionamento {API_URL}/api/auth/oauth/google/callback.

const ORANGE_GOOGLE_STATE_COOKIE = 'orange_oauth_google';

function orange_google_configured(): bool
{
    return orange_config('GOOGLE_CLIENT_ID') !== '' && orange_config('GOOGLE_CLIENT_SECRET') !== '';
}

function orange_api_origin(): string
{
    $url = rtrim(orange_config('API_URL', 'https://api-app.bebaorange.com'), '/');
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])
        || (strtolower($parts['scheme']) !== 'https' && orange_config('NODE_ENV') === 'production')) {
        orange_fail(503, 'API_URL precisa ser uma origem HTTPS válida.');
    }
    return strtolower($parts['scheme']) . '://' . strtolower($parts['host'])
        . (isset($parts['port']) ? ':' . $parts['port'] : '');
}

function orange_google_redirect_uri(): string
{
    return orange_api_origin() . '/api/auth/oauth/google/callback';
}

function orange_base64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function orange_base64url_decode(string $value): string|false
{
    $standard = strtr($value, '-_', '+/');
    return base64_decode($standard . str_repeat('=', (4 - strlen($standard) % 4) % 4), true);
}

function orange_redirect(string $url): never
{
    header('Cache-Control: no-store');
    header('Location: ' . $url, true, 302);
    exit;
}

function orange_oauth_fail_redirect(string $reason = 'error'): never
{
    orange_redirect(orange_origin() . '/login/?oauth=' . ($reason === 'cancelled' ? 'cancelled' : 'error'));
}

function orange_google_start(): never
{
    if (!orange_google_configured()) {
        orange_oauth_fail_redirect();
    }
    $state = orange_random_token();
    $nonce = orange_random_token();
    $verifier = orange_random_token();
    $challenge = orange_base64url(hash('sha256', $verifier, true));
    orange_set_cookie(ORANGE_GOOGLE_STATE_COOKIE, "{$state}.{$nonce}.{$verifier}", time() + 10 * 60);

    $query = http_build_query([
        'client_id' => orange_config('GOOGLE_CLIENT_ID'),
        'redirect_uri' => orange_google_redirect_uri(),
        'response_type' => 'code',
        'scope' => 'openid email profile',
        'state' => $state,
        'nonce' => $nonce,
        'prompt' => 'select_account',
        'code_challenge' => $challenge,
        'code_challenge_method' => 'S256',
    ], '', '&', PHP_QUERY_RFC3986);
    orange_redirect('https://accounts.google.com/o/oauth2/v2/auth?' . $query);
}

/** POST x-www-form-urlencoded e retorna [status, corpo JSON decodificado]. */
function orange_http_post_form(string $url, array $fields): array
{
    $body = http_build_query($fields, '', '&');
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        ]);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\nAccept: application/json\r\n",
                'content' => $body,
                'timeout' => 10,
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $raw = @file_get_contents($url, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match) === 1) {
                $status = (int) $match[1];
            }
        }
    }
    if (!is_string($raw)) {
        return [0, []];
    }
    $decoded = json_decode($raw, true);
    return [$status, is_array($decoded) ? $decoded : []];
}

/**
 * Troca o código pelo id_token e valida as declarações. O token vem direto do endpoint do Google
 * por TLS, autenticado com o client secret, o que dispensa a checagem da assinatura
 * (OpenID Connect Core 1.0, seção 3.1.3.7).
 */
function orange_google_identity(string $code, string $nonce, string $verifier): array
{
    [$status, $tokens] = orange_http_post_form('https://oauth2.googleapis.com/token', [
        'grant_type' => 'authorization_code',
        'code' => $code,
        'client_id' => orange_config('GOOGLE_CLIENT_ID'),
        'client_secret' => orange_config('GOOGLE_CLIENT_SECRET'),
        'redirect_uri' => orange_google_redirect_uri(),
        'code_verifier' => $verifier,
    ]);
    $idToken = $tokens['id_token'] ?? null;
    if ($status !== 200 || !is_string($idToken)) {
        error_log('Orange OAuth: Google recusou a troca do código (' . $status . ').');
        throw new RuntimeException('Google token exchange failed.');
    }
    $parts = explode('.', $idToken);
    $payload = count($parts) === 3 ? orange_base64url_decode($parts[1]) : false;
    $claims = is_string($payload) ? json_decode($payload, true) : null;
    if (!is_array($claims)) {
        throw new RuntimeException('Invalid Google ID token.');
    }

    $now = time();
    $audience = $claims['aud'] ?? null;
    $audienceOk = is_string($audience)
        ? hash_equals(orange_config('GOOGLE_CLIENT_ID'), $audience)
        : (is_array($audience) && in_array(orange_config('GOOGLE_CLIENT_ID'), $audience, true));
    if (!in_array($claims['iss'] ?? null, ['https://accounts.google.com', 'accounts.google.com'], true)
        || !$audienceOk
        || !is_int($claims['exp'] ?? null) || $claims['exp'] < $now - 60
        || !is_int($claims['iat'] ?? null) || $claims['iat'] > $now + 300
        || !is_string($claims['nonce'] ?? null) || !hash_equals($nonce, $claims['nonce'])
        || !is_string($claims['sub'] ?? null) || $claims['sub'] === '') {
        throw new RuntimeException('Google ID token claims rejected.');
    }

    $email = is_string($claims['email'] ?? null) ? strtolower(trim($claims['email'])) : '';
    $verified = ($claims['email_verified'] ?? false) === true || ($claims['email_verified'] ?? '') === 'true';
    if ($email === '' || !$verified || !orange_validate_email($email)) {
        throw new RuntimeException('Google account without a verified e-mail.');
    }
    $name = is_string($claims['name'] ?? null) ? trim($claims['name']) : '';
    if (orange_text_length($name) > 120) {
        $name = preg_replace('/^(.{120}).*$/us', '$1', $name) ?? '';
    }
    return ['subject' => $claims['sub'], 'email' => $email, 'name' => $name === '' ? null : $name];
}

/** Encontra ou cria o cliente ligado à conta Google. Contas da equipe (ADMIN) não entram por aqui. */
function orange_google_user(array $identity): array
{
    $db = orange_db();
    $findLinked = $db->prepare(
        'SELECT u.* FROM oauth_accounts o JOIN users u ON u.id = o.userId
         WHERE o.provider = \'GOOGLE\' AND o.subject = ? LIMIT 1',
    );
    $findLinked->execute([$identity['subject']]);
    $linked = $findLinked->fetch();
    if (is_array($linked)) {
        if ($linked['role'] !== 'CUSTOMER') {
            throw new RuntimeException('Staff account cannot use Google login.');
        }
        return $linked;
    }

    $db->beginTransaction();
    try {
        $now = orange_now();
        $user = orange_get_user_by_email($identity['email']);
        if ($user !== null && $user['role'] !== 'CUSTOMER') {
            throw new RuntimeException('Staff account cannot use Google login.');
        }
        $isNewOrJustVerified = $user === null || (int) $user['emailVerified'] !== 1;
        if ($user === null) {
            $user = [
                'id' => orange_uuid(),
                'email' => $identity['email'],
                'name' => $identity['name'],
                'role' => 'CUSTOMER',
                'mfaEnabled' => 0,
            ];
            $insert = $db->prepare(
                'INSERT INTO users (id, email, name, passwordHash, role, emailVerified, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, \'CUSTOMER\', true, ?, ?)',
            );
            $insert->execute([
                $user['id'], $user['email'], $user['name'],
                orange_hash_password(orange_random_token()), $now, $now,
            ]);
        } elseif ((int) $user['emailVerified'] !== 1) {
            // Cadastro nunca confirmado com este e-mail: o Google comprova o dono do endereço, então a
            // senha definida por quem fez esse cadastro é descartada e as sessões antigas caem.
            $update = $db->prepare('UPDATE users SET emailVerified = true, passwordHash = ?, updatedAt = ? WHERE id = ?');
            $update->execute([orange_hash_password(orange_random_token()), $now, $user['id']]);
            foreach (['auth_sessions', 'auth_challenges'] as $table) {
                $delete = $db->prepare("DELETE FROM {$table} WHERE userId = ?");
                $delete->execute([$user['id']]);
            }
        }
        $link = $db->prepare(
            'INSERT INTO oauth_accounts (id, provider, subject, providerEmail, userId) VALUES (?, \'GOOGLE\', ?, ?, ?)',
        );
        $link->execute([orange_uuid(), $identity['subject'], $identity['email'], $user['id']]);
        $db->commit();
        // Conta nova ou confirmada agora pelo Google: recebe as mesmas boas-vindas do link de e-mail.
        $user['welcomeEmailEligible'] = $isNewOrJustVerified;
        return $user;
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        // Dois retornos simultâneos do Google: o outro já criou o vínculo.
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            $findLinked->execute([$identity['subject']]);
            $linked = $findLinked->fetch();
            if (is_array($linked) && $linked['role'] === 'CUSTOMER') {
                return $linked;
            }
        }
        throw $error;
    }
}

function orange_google_callback(): never
{
    $stored = orange_cookie(ORANGE_GOOGLE_STATE_COOKIE);
    orange_clear_cookie(ORANGE_GOOGLE_STATE_COOKIE);

    $error = isset($_GET['error']) && is_string($_GET['error']) ? $_GET['error'] : '';
    if ($error !== '') {
        orange_oauth_fail_redirect($error === 'access_denied' ? 'cancelled' : 'error');
    }
    $code = isset($_GET['code']) && is_string($_GET['code']) ? $_GET['code'] : '';
    $state = isset($_GET['state']) && is_string($_GET['state']) ? $_GET['state'] : '';
    [$expectedState, $nonce, $verifier] = array_pad(explode('.', $stored ?? ''), 3, '');
    if (!orange_google_configured() || $code === '' || $state === '' || $expectedState === ''
        || $nonce === '' || $verifier === '' || !hash_equals($expectedState, $state)) {
        orange_oauth_fail_redirect();
    }

    try {
        $user = orange_google_user(orange_google_identity($code, $nonce, $verifier));
    } catch (Throwable $failure) {
        error_log('Orange OAuth: login Google recusado (' . get_class($failure) . ').');
        orange_oauth_fail_redirect();
    }

    if (!empty($user['welcomeEmailEligible'])) {
        orange_welcome_new_account((string) $user['email']);
    }

    $previous = orange_cookie('orange_session');
    if ($previous !== null) {
        $delete = orange_db()->prepare('DELETE FROM auth_sessions WHERE tokenHash = ?');
        $delete->execute([orange_token_hash($previous)]);
    }
    if ((bool) $user['mfaEnabled']) {
        orange_clear_cookie('orange_session');
        orange_create_mfa_challenge($user);
        orange_redirect(orange_origin() . '/login/?mfa=1');
    }
    orange_create_session($user);
    orange_redirect(orange_origin() . '/central-de-operacoes/');
}
