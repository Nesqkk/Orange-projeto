<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/src/common.php';

$configured = orange_config('SEED_ADMIN_USERS');
try {
    $admins = json_decode($configured, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    fwrite(STDERR, "SEED_ADMIN_USERS must be valid JSON.\n");
    exit(1);
}
if (!is_array($admins) || $admins === []) {
    fwrite(STDERR, "SEED_ADMIN_USERS is empty; no administrators were created.\n");
    exit(1);
}

$db = orange_db();
$created = 0;
foreach ($admins as $admin) {
    if (!is_array($admin) || !is_string($admin['email'] ?? null) || !is_string($admin['password'] ?? null)) {
        fwrite(STDERR, "Each administrator needs an email and password.\n");
        exit(1);
    }
    $email = strtolower(trim($admin['email']));
    $password = $admin['password'];
    if (!orange_validate_email($email) || strlen($password) < 16 || strlen($password) > 128) {
        fwrite(STDERR, "Administrator email or password does not meet the required format.\n");
        exit(1);
    }
    $lookup = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $lookup->execute([$email]);
    if ($lookup->fetch()) {
        fwrite(STDERR, "An account with the configured administrator email already exists; no changes were made.\n");
        exit(1);
    }
    $now = orange_now();
    $insert = $db->prepare(
        'INSERT INTO users (id, email, passwordHash, role, emailVerified, createdAt, updatedAt)
         VALUES (?, ?, ?, \'ADMIN\', true, ?, ?)',
    );
    $insert->execute([orange_uuid(), $email, orange_hash_password($password), $now, $now]);
    $created++;
}

fwrite(STDOUT, "Created {$created} administrator account(s).\n");
