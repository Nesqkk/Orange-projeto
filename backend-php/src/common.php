<?php

declare(strict_types=1);

final class OrangeApiError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

$orangeConfigPath = getenv('ORANGE_CONFIG_FILE') ?: dirname(__DIR__, 2) . '/orange-config.php';
$orangeConfig = is_file($orangeConfigPath) ? require $orangeConfigPath : [];
if (!is_array($orangeConfig)) {
    throw new RuntimeException('Orange configuration file must return an array.');
}

function orange_config(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value !== false) {
        $value = (string) $value;
        return in_array($key, ['DB_PASSWORD', 'SMTP_PASSWORD'], true) ? $value : trim($value);
    }
    $value = (string) ($GLOBALS['orangeConfig'][$key] ?? $default);
    return in_array($key, ['DB_PASSWORD', 'SMTP_PASSWORD'], true) ? $value : trim($value);
}

function orange_fail(int $status, string $message): never
{
    throw new OrangeApiError($status, $message);
}

function orange_json(int $status, mixed $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function orange_now(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
}

function orange_iso_date(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d\TH:i:s.v\Z');
}

function orange_timestamp(string $value): int
{
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->getTimestamp();
}

function orange_db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!in_array('mysql', PDO::getAvailableDrivers(), true)) {
        orange_fail(503, 'O driver PDO MySQL precisa estar habilitado no servidor.');
    }

    $host = orange_config('DB_HOST');
    $port = orange_config('DB_PORT', '3306');
    $name = orange_config('DB_NAME');
    $user = orange_config('DB_USER');
    $password = orange_config('DB_PASSWORD');
    if ($host === '' || $name === '' || $user === '' || $password === '') {
        orange_fail(503, 'A conexão com o banco ainda não foi configurada.');
    }

    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    );
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function orange_origin(): string
{
    $url = orange_config('FRONTEND_URL');
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        orange_fail(503, 'FRONTEND_URL precisa ser uma origem HTTPS válida.');
    }
    if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
        || (isset($parts['path']) && !in_array($parts['path'], ['', '/'], true))) {
        orange_fail(503, 'FRONTEND_URL precisa conter somente a origem do site.');
    }
    if (strtolower($parts['scheme']) !== 'https' && orange_config('NODE_ENV') === 'production') {
        orange_fail(503, 'FRONTEND_URL precisa usar HTTPS em produção.');
    }
    return strtolower($parts['scheme']) . '://' . strtolower($parts['host'])
        . (isset($parts['port']) ? ':' . $parts['port'] : '');
}

function orange_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    header('Vary: Origin');
    if ($origin !== '') {
        if (!hash_equals(orange_origin(), rtrim($origin, '/'))) {
            orange_fail(403, 'Origem não autorizada.');
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function orange_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > 1048576) {
        orange_fail(413, 'O corpo da solicitação excede o limite permitido.');
    }
    try {
        $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        orange_fail(400, 'O corpo da solicitação precisa ser JSON válido.');
    }
    if (!is_array($body)) {
        orange_fail(400, 'O corpo da solicitação precisa ser um objeto JSON.');
    }
    return $body;
}

function orange_string(array $body, string $key): string
{
    return isset($body[$key]) && is_string($body[$key]) ? trim($body[$key]) : '';
}

function orange_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
        . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function orange_valid_uuid(string $value): bool
{
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
}

function orange_validate_email(string $email): bool
{
    return strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function orange_text_length(string $value): int
{
    $length = preg_match_all('/./us', $value);
    return is_int($length) ? $length : -1;
}

function orange_validate_password(string $password): bool
{
    $length = orange_text_length($password);
    return $length >= 12 && $length <= 128 && strlen($password) <= 512;
}

function orange_hash_password(string $password): string
{
    $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $hash = password_hash($password, $algorithm);
    if (!is_string($hash)) {
        throw new RuntimeException('Password hashing failed.');
    }
    return $hash;
}

function orange_identity(array $user): array
{
    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'name' => $user['name'],
        'mfaEnabled' => (bool) $user['mfaEnabled'],
        'mfaSetupRequired' => (bool) ($user['googleLinked'] ?? 0) && !(bool) $user['mfaEnabled'],
    ];
}

function orange_session_cookie_options(int $expires): array
{
    $secure = orange_config('NODE_ENV') === 'production';
    $domain = orange_config('COOKIE_DOMAIN', '.bebaorange.com');
    $options = [
        'expires' => $expires,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    if ($domain !== '') {
        $options['domain'] = $domain;
    }
    return $options;
}

function orange_set_cookie(string $name, string $value, int $expires): void
{
    if (!setcookie($name, $value, orange_session_cookie_options($expires))) {
        throw new RuntimeException('Could not set authentication cookie.');
    }
}

function orange_clear_cookie(string $name): void
{
    orange_set_cookie($name, '', time() - 3600);
}

function orange_cookie(string $name): ?string
{
    $value = $_COOKIE[$name] ?? null;
    return is_string($value) && $value !== '' ? $value : null;
}

function orange_client_ip(): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    $hops = max(0, min(5, (int) orange_config('TRUST_PROXY_HOPS', '0')));
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    $remoteIsProxy = filter_var(
        $remote,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
    ) === false;
    if ($hops > 0 && $remoteIsProxy && $forwarded !== '') {
        $addresses = array_map('trim', explode(',', $forwarded));
        $candidateIndex = count($addresses) - $hops;
        $candidate = $candidateIndex >= 0 ? ($addresses[$candidateIndex] ?? $remote) : $remote;
        if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }
    return filter_var($remote, FILTER_VALIDATE_IP) !== false ? $remote : 'unknown';
}

function orange_rate_limit(string $name, int $limit, int $seconds): void
{
    $windowStart = intdiv(time(), $seconds) * $seconds;
    $bucket = hash('sha256', $name . "\0" . orange_client_ip());
    $statement = orange_db()->prepare(
        'INSERT INTO api_rate_limits (bucket, windowStart, hits) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE hits = hits + 1',
    );
    $statement->execute([$bucket, $windowStart]);
    $statement = orange_db()->prepare('SELECT hits FROM api_rate_limits WHERE bucket = ? AND windowStart = ?');
    $statement->execute([$bucket, $windowStart]);
    if ((int) $statement->fetchColumn() > $limit) {
        orange_fail(429, 'Muitas tentativas. Aguarde um momento e tente novamente.');
    }
}

function orange_auth_user(bool $adminOnly = false): array
{
    $token = orange_cookie('orange_session');
    if ($token === null) {
        orange_fail(401, 'Sessão inválida ou expirada.');
    }
    $statement = orange_db()->prepare(
        'SELECT u.id, u.email, u.name, u.role, u.mfaEnabled, s.id AS sessionId, s.expiresAt,
                EXISTS(SELECT 1 FROM oauth_accounts o WHERE o.userId = u.id AND o.provider = \'GOOGLE\') AS googleLinked
         FROM auth_sessions s JOIN users u ON u.id = s.userId
         WHERE s.tokenHash = ? LIMIT 1',
    );
    $statement->execute([hash('sha256', $token)]);
    $user = $statement->fetch();
    if (!$user || orange_timestamp((string) $user['expiresAt']) <= time()) {
        if ($user) {
            $delete = orange_db()->prepare('DELETE FROM auth_sessions WHERE id = ?');
            $delete->execute([$user['sessionId']]);
        }
        orange_fail(401, 'Sessão inválida ou expirada.');
    }
    if ($adminOnly && $user['role'] !== 'ADMIN') {
        orange_fail(401, 'Acesso restrito à equipe Orange.');
    }
    unset($user['sessionId'], $user['expiresAt']);
    $user['mfaEnabled'] = (bool) $user['mfaEnabled'];
    return $user;
}

function orange_create_session(array $user): array
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $expires = time() + 12 * 60 * 60;
    $delete = orange_db()->prepare('DELETE FROM auth_sessions WHERE expiresAt <= ?');
    $delete->execute([orange_now()]);
    $statement = orange_db()->prepare(
        'INSERT INTO auth_sessions (id, tokenHash, userId, expiresAt) VALUES (?, ?, ?, ?)',
    );
    $statement->execute([
        orange_uuid(),
        hash('sha256', $token),
        $user['id'],
        gmdate('Y-m-d H:i:s', $expires),
    ]);
    orange_set_cookie('orange_session', $token, $expires);
    orange_clear_cookie('orange_mfa_challenge');
    return orange_identity($user);
}

function orange_mfa_key(): string
{
    $configured = orange_config('MFA_ENCRYPTION_KEY');
    if ($configured === '') {
        orange_fail(503, 'MFA_ENCRYPTION_KEY precisa ser configurada no servidor.');
    }
    if (preg_match('/^[a-f0-9]{64}$/i', $configured) === 1) {
        $key = hex2bin($configured);
    } else {
        $key = base64_decode($configured, true);
    }
    if (!is_string($key) || strlen($key) !== 32) {
        orange_fail(503, 'MFA_ENCRYPTION_KEY deve representar 32 bytes em hexadecimal ou Base64.');
    }
    return $key;
}

function orange_encrypt_mfa(string $secret): string
{
    $iv = random_bytes(12);
    $tag = '';
    $encrypted = openssl_encrypt($secret, 'aes-256-gcm', orange_mfa_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($encrypted)) {
        throw new RuntimeException('MFA encryption failed.');
    }
    $base64url = static fn(string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    return 'v1.' . $base64url($iv) . '.' . $base64url($tag) . '.' . $base64url($encrypted);
}

function orange_decrypt_mfa(string $value): string
{
    $parts = explode('.', $value);
    if (count($parts) !== 4 || $parts[0] !== 'v1') {
        orange_fail(500, 'Segredo MFA salvo em formato inválido.');
    }
    $decode = static function (string $encoded): string|false {
        $standard = strtr($encoded, '-_', '+/');
        return base64_decode($standard . str_repeat('=', (4 - strlen($standard) % 4) % 4), true);
    };
    $iv = $decode($parts[1]);
    $tag = $decode($parts[2]);
    $data = $decode($parts[3]);
    if (!is_string($iv) || !is_string($tag) || !is_string($data)) {
        orange_fail(500, 'Segredo MFA salvo em formato inválido.');
    }
    $secret = openssl_decrypt($data, 'aes-256-gcm', orange_mfa_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($secret)) {
        orange_fail(500, 'Não foi possível abrir o segredo MFA. Verifique a chave de criptografia.');
    }
    return $secret;
}

function orange_create_totp_secret(): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = 0;
    $value = 0;
    $output = '';
    foreach (str_split(random_bytes(20)) as $byte) {
        $value = ($value << 8) | ord($byte);
        $bits += 8;
        while ($bits >= 5) {
            $output .= $alphabet[($value >> ($bits - 5)) & 31];
            $bits -= 5;
            $value &= (1 << $bits) - 1;
        }
    }
    if ($bits > 0) {
        $output .= $alphabet[($value << (5 - $bits)) & 31];
    }
    return $output;
}

function orange_base32_decode(string $value): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = 0;
    $buffer = 0;
    $result = '';
    foreach (str_split(rtrim(strtoupper($value), '=')) as $character) {
        $digit = strpos($alphabet, $character);
        if ($digit === false) {
            throw new RuntimeException('Invalid base32 MFA secret.');
        }
        $buffer = ($buffer << 5) | $digit;
        $bits += 5;
        if ($bits >= 8) {
            $result .= chr(($buffer >> ($bits - 8)) & 255);
            $bits -= 8;
            $buffer &= (1 << $bits) - 1;
        }
    }
    return $result;
}

function orange_totp_at(string $secret, int $counter): string
{
    $high = intdiv($counter, 0x100000000);
    $low = $counter % 0x100000000;
    $digest = hash_hmac('sha1', pack('N2', $high, $low), orange_base32_decode($secret), true);
    $offset = ord($digest[19]) & 0x0f;
    $binary = ((ord($digest[$offset]) & 0x7f) << 24)
        | ((ord($digest[$offset + 1]) & 0xff) << 16)
        | ((ord($digest[$offset + 2]) & 0xff) << 8)
        | (ord($digest[$offset + 3]) & 0xff);
    return str_pad((string) ($binary % 1000000), 6, '0', STR_PAD_LEFT);
}

function orange_verify_totp(string $secret, string $code): bool
{
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (preg_match('/^\d{6}$/', $code) !== 1) {
        return false;
    }
    $counter = intdiv(time(), 30);
    foreach ([-1, 0, 1] as $drift) {
        if (hash_equals(orange_totp_at($secret, $counter + $drift), $code)) {
            return true;
        }
    }
    return false;
}

function orange_normalize_backup_code(string $code): string
{
    return strtoupper(preg_replace('/[^a-f0-9]/i', '', $code) ?? '');
}

function orange_verify_mfa(array $user, string $code, bool $allowBackup): bool
{
    if (!empty($user['mfaSecret']) && orange_verify_totp(orange_decrypt_mfa((string) $user['mfaSecret']), $code)) {
        return true;
    }
    if (!$allowBackup || empty($user['mfaBackupCodes'])) {
        return false;
    }
    $hashes = json_decode((string) $user['mfaBackupCodes'], true);
    if (!is_array($hashes)) {
        throw new RuntimeException('Invalid stored MFA backup codes.');
    }
    $candidate = hash('sha256', orange_normalize_backup_code($code));
    foreach ($hashes as $index => $hash) {
        if (is_string($hash) && hash_equals($hash, $candidate)) {
            unset($hashes[$index]);
            $update = orange_db()->prepare(
                'UPDATE users SET mfaBackupCodes = ? WHERE id = ? AND mfaBackupCodes = ?',
            );
            $update->execute([
                json_encode(array_values($hashes), JSON_THROW_ON_ERROR),
                $user['id'],
                $user['mfaBackupCodes'],
            ]);
            return $update->rowCount() === 1;
        }
    }
    return false;
}
