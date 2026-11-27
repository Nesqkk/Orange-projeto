<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/common.php';
require_once __DIR__ . '/../src/mailer.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/broadcasts.php';
require_once __DIR__ . '/../src/oauth.php';

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

$customBroadcast = [
    'subject' => 'Novidades Orange',
    'headline' => 'Olá, {{nome}}',
    'highlight' => 'Oferta',
    'body' => "Primeira linha\n\nSegunda linha",
    'imageUrl' => 'https://app.bebaorange.com/banner.webp',
    'ctaLabel' => 'Ver oferta',
    'ctaUrl' => 'https://app.bebaorange.com/oferta',
    'customHtml' => '<!doctype html><html><body><h1>{{titulo}}</h1><p>{{mensagem}}</p><div>{{imagem}}</div><a href="{{cta_url}}">{{cta_label}}</a></body></html>',
];
$customHtml = orange_broadcast_html($customBroadcast, '<Ana>', 'https://api.bebaorange.com/unsubscribe?token=abc');
check(str_contains($customHtml, '<h1>Olá, &lt;Ana&gt;</h1>'), 'Custom HTML did not safely personalize the name.');
check(str_contains($customHtml, 'src="https://app.bebaorange.com/banner.webp"'), 'Custom HTML image placeholder was not filled.');
check(str_contains($customHtml, 'href="https://api.bebaorange.com/unsubscribe?token=abc"'), 'Custom HTML omitted the automatic unsubscribe link.');
check(str_contains($customHtml, '<a href="https://app.bebaorange.com/oferta">Ver oferta</a>'), 'Custom HTML CTA placeholders were not filled.');
$customText = orange_broadcast_text($customBroadcast, 'Ana', 'https://api.bebaorange.com/unsubscribe?token=abc');
check(str_contains($customText, 'Olá, Ana'), 'Custom text alternative did not personalize the name.');
check(str_contains($customText, 'https://api.bebaorange.com/unsubscribe?token=abc'), 'Custom text alternative omitted the unsubscribe link.');

putenv('MFA_ENCRYPTION_KEY=' . bin2hex(random_bytes(32)));
$encrypted = orange_encrypt_mfa($secret);
check(orange_decrypt_mfa($encrypted) === $secret, 'MFA encryption round-trip failed.');

// Fluxo de cadastro: links de confirmação/descadastro e boas-vindas tolerante a falha de SMTP.
putenv('FRONTEND_URL=https://app.bebaorange.com');
putenv('API_URL=https://api-app.bebaorange.com');
foreach (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as $smtpKey) {
    putenv($smtpKey . '=');
}
check(orange_origin() === 'https://app.bebaorange.com', 'Confirmation link origin is incorrect.');
check(strlen(orange_random_token()) === 43, 'Verification token length changed (verify accepts 32-128 chars).');
check(orange_token_hash('abc') === hash('sha256', 'abc'), 'Verification token hash changed.');
$unsubscribeUrl = orange_unsubscribe_url('Ana@Exemplo.com');
parse_str((string) parse_url($unsubscribeUrl, PHP_URL_QUERY), $unsubscribeQuery);
check(str_starts_with($unsubscribeUrl, 'https://api-app.bebaorange.com/api/email/unsubscribe?'), 'Unsubscribe URL host is incorrect.');
check(orange_base64url_decode((string) ($unsubscribeQuery['e'] ?? '')) === 'ana@exemplo.com', 'Unsubscribe URL e-mail was not normalized.');
check(hash_equals(orange_unsubscribe_token('ana@exemplo.com'), (string) ($unsubscribeQuery['t'] ?? '')), 'Unsubscribe token does not validate.');
check(orange_deliver_welcome_email('ana@exemplo.com') === false, 'Welcome e-mail failure must not throw (signup already succeeded).');
check(function_exists('orange_welcome_new_account'), 'Google signup welcome helper is missing.');

fwrite(STDOUT, "PHP auth self-test passed.\n");
