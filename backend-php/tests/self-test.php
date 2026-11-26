<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/common.php';
require_once __DIR__ . '/../src/mailer.php';
require_once __DIR__ . '/../src/auth.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

check(orange_totp_at('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1) === '287082', 'TOTP test vector failed.');
check(orange_timestamp('2025-01-01 00:00:00') === 1735689600, 'UTC timestamp parsing failed.');
check(orange_validate_password(str_repeat("\u{00E1}", 12)), 'Unicode password length validation failed.');
check(!orange_validate_password(str_repeat('a', 11)), 'Short password was accepted.');
check(!orange_validate_password(str_repeat('a', 129)), 'Long password was accepted.');
check(!orange_validate_password(str_repeat("\xFF", 12)), 'Invalid UTF-8 password was accepted.');
check(orange_verification_resend_allowed(null, 1735689660), 'First verification resend was blocked.');
check(!orange_verification_resend_allowed('2025-01-01 00:00:01', 1735689660), 'Verification resend cooldown was bypassed.');
check(orange_verification_resend_allowed('2025-01-01 00:00:00', 1735689660), 'Verification resend cooldown did not expire after one minute.');

$secret = orange_create_totp_secret();
check(strlen($secret) === 32, 'Generated TOTP secret length is incorrect.');
check(strlen(orange_base32_decode($secret)) === 20, 'Generated TOTP secret did not round-trip.');

$passwordHash = orange_hash_password('Orange-test-password-2026');
check(password_verify('Orange-test-password-2026', $passwordHash), 'Password hash verification failed.');
check(!password_verify('incorrect-password', $passwordHash), 'Incorrect password was accepted.');

$confirmationHtml = orange_verification_email_html(
    'https://app.bebaorange.com',
    '<Ana>',
    'https://app.bebaorange.com/confirmar-email?token=abc&next=home',
);
check(str_contains($confirmationHtml, '&lt;Ana&gt;'), 'Email name was not escaped.');
check(str_contains($confirmationHtml, 'Confirmar meu e-mail'), 'Confirmation email CTA is missing.');
check(str_contains($confirmationHtml, 'orange-logo.png'), 'Email logo URL is missing.');
check(str_contains($confirmationHtml, 'token=abc&amp;next=home'), 'Confirmation link was not escaped.');
check(!str_contains($confirmationHtml, '/redefinir-senha'), 'Confirmation email included a password-reset link.');

$resetHtml = orange_password_reset_email_html(
    'https://app.bebaorange.com',
    'Ana',
    'https://app.bebaorange.com/redefinir-senha?token=reset-token',
);
check(str_contains($resetHtml, 'Redefinir minha senha'), 'Password-reset email CTA is missing.');
check(str_contains($resetHtml, '30 minutos'), 'Password-reset expiry is missing.');
check(!str_contains($resetHtml, '/confirmar-email'), 'Password-reset email included a verification link.');

$welcomeHtml = orange_welcome_email_html(
    'https://app.bebaorange.com',
    'https://api-app.bebaorange.com/api/email/unsubscribe?e=abc&t=def',
);
check(str_contains($welcomeHtml, '10% OFF'), 'Welcome discount was omitted.');
check(str_contains($welcomeHtml, 'https://app.bebaorange.com/orange-logo.png'), 'Welcome email logo URL is incorrect.');
check(str_contains($welcomeHtml, 'https://app.bebaorange.com/privacidade'), 'Privacy link was not filled in.');
check(str_contains($welcomeHtml, 'e=abc&amp;t=def'), 'Unsubscribe URL was not escaped.');
check(!str_contains($welcomeHtml, '{{privacy}}'), 'Privacy placeholder was not replaced.');
check(!str_contains($welcomeHtml, '{{unsubscribe}}'), 'Unsubscribe placeholder was not replaced.');

putenv('MFA_ENCRYPTION_KEY=' . bin2hex(random_bytes(32)));
$encrypted = orange_encrypt_mfa($secret);
check(orange_decrypt_mfa($encrypted) === $secret, 'MFA encryption round-trip failed.');

fwrite(STDOUT, "PHP auth self-test passed.\n");
