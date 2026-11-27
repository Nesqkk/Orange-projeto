<?php

declare(strict_types=1);

function orange_smtp_configured(): bool
{
    return orange_config('SMTP_HOST') !== ''
        && orange_config('SMTP_USER') !== ''
        && orange_config('SMTP_PASSWORD') !== ''
        && (orange_config('SMTP_FROM') !== '' || orange_config('SMTP_USER') !== '');
}

function orange_smtp_read($socket, array $expected): string
{
    $response = '';
    do {
        $line = fgets($socket, 515);
        if ($line === false) {
            $meta = stream_get_meta_data($socket);
            throw new RuntimeException(!empty($meta['timed_out'])
                ? 'SMTP server did not answer in time (timeout).'
                : 'SMTP server closed the connection.');
        }
        $response .= $line;
    } while (isset($line[3]) && $line[3] === '-');

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expected, true)) {
        throw new OrangeSmtpError($code, trim(substr($response, 0, 200)));
    }
    return $response;
}

/** Falha do servidor de e-mail, com o código e a resposta dele (nunca contém a senha). */
final class OrangeSmtpError extends RuntimeException
{
    public string $stage = '';

    public function __construct(public readonly int $smtpCode, public readonly string $reply)
    {
        parent::__construct('SMTP ' . $smtpCode . ': ' . $reply);
    }
}

function orange_smtp_command($socket, string $command, array $expected, string $stage = ''): string
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException('Could not write to SMTP server.');
    }
    try {
        return orange_smtp_read($socket, $expected);
    } catch (OrangeSmtpError $error) {
        $error->stage = $stage !== '' ? $stage : strtok($command, ' :');
        throw $error;
    }
}

function orange_smtp_stage(?string $stage = null): string
{
    static $current = 'CONNECT';
    if ($stage !== null) {
        $current = $stage;
    }
    return $current;
}

function orange_smtp_from(): string
{
    $from = orange_config('SMTP_FROM');
    return $from !== '' ? $from : orange_config('SMTP_USER');
}

/** Abre a conexão SMTP e faz o login. Usado pelo envio e pelo teste do painel. */
function orange_smtp_open(?int $portOverride = null)
{
    orange_smtp_stage('CONNECT');
    if (!orange_smtp_configured()) {
        orange_fail(503, 'O envio de e-mail ainda não está configurado.');
    }
    $host = orange_config('SMTP_HOST');
    $port = $portOverride ?? (int) orange_config('SMTP_PORT', '465');
    $username = orange_config('SMTP_USER');
    $password = orange_config('SMTP_PASSWORD');
    if ($port < 1 || $port > 65535 || preg_match('/[\r\n]/', $host . $username . orange_smtp_from()) === 1) {
        orange_fail(503, 'A configuração SMTP é inválida.');
    }
    $transport = $port === 465 ? 'ssl://' : 'tcp://';
    $socket = @stream_socket_client(
        $transport . $host . ':' . $port,
        $errorCode,
        $errorMessage,
        15,
        STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]),
    );
    if (!is_resource($socket)) {
        throw new RuntimeException('Could not connect to SMTP server ' . $host . ':' . $port . ' (' . $errorCode . ' ' . $errorMessage . ').');
    }
    stream_set_timeout($socket, 15);
    try {
        orange_smtp_stage('GREETING');
        orange_smtp_read($socket, [220]);
        $ehlo = parse_url(orange_config('FRONTEND_URL'), PHP_URL_HOST) ?: 'orange.local';
        orange_smtp_stage('EHLO');
        orange_smtp_command($socket, 'EHLO ' . $ehlo, [250], 'EHLO');
        if ($port !== 465) {
            orange_smtp_stage('STARTTLS');
            orange_smtp_command($socket, 'STARTTLS', [220], 'STARTTLS');
            if (stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) !== true) {
                throw new RuntimeException('Could not establish SMTP TLS.');
            }
            orange_smtp_command($socket, 'EHLO ' . $ehlo, [250], 'EHLO');
        }
        orange_smtp_stage('AUTH LOGIN');
        orange_smtp_command($socket, 'AUTH LOGIN', [334], 'AUTH');
        orange_smtp_stage('AUTH USER');
        orange_smtp_command($socket, base64_encode($username), [334], 'AUTH');
        orange_smtp_stage('AUTH PASSWORD');
        orange_smtp_command($socket, base64_encode($password), [235], 'AUTH');
        orange_smtp_stage('LOGGED IN');
    } catch (Throwable $error) {
        fclose($socket);
        throw $error;
    }
    return $socket;
}

/** Teste do painel: conecta, faz login e testa remetente e destinatário, sem enviar mensagem. */
function orange_smtp_try(string $recipient, int $port): array
{
    $result = ['port' => $port, 'ok' => false, 'stage' => 'CONNECT', 'reply' => null, 'seconds' => 0.0];
    $started = microtime(true);
    try {
        $socket = orange_smtp_open($port);
        try {
            orange_smtp_stage('MAIL FROM');
            orange_smtp_command($socket, 'MAIL FROM:<' . orange_smtp_from() . '>', [250], 'MAIL FROM');
            orange_smtp_stage('RCPT TO');
            orange_smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251], 'RCPT TO');
            orange_smtp_command($socket, 'RSET', [250], 'RSET');
            @fwrite($socket, "QUIT\r\n");
            $result['ok'] = true;
            orange_smtp_stage('OK');
        } finally {
            fclose($socket);
        }
    } catch (OrangeSmtpError $error) {
        $result['reply'] = $error->reply;
    } catch (Throwable $error) {
        $result['reply'] = $error->getMessage();
    }
    $result['stage'] = orange_smtp_stage();
    $result['seconds'] = round(microtime(true) - $started, 2);
    return $result;
}

function orange_smtp_check(string $recipient): array
{
    $configured = (int) orange_config('SMTP_PORT', '465');
    $alternative = $configured === 465 ? 587 : 465;
    return [
        'host' => orange_config('SMTP_HOST'),
        'user' => orange_config('SMTP_USER'),
        'from' => orange_smtp_from(),
        'fromMatchesUser' => strtolower(orange_smtp_from()) === strtolower(orange_config('SMTP_USER')),
        'passwordLength' => strlen(orange_config('SMTP_PASSWORD')),
        'configuredPort' => orange_smtp_try($recipient, $configured),
        'alternativePort' => orange_smtp_try($recipient, $alternative),
    ];
}

function orange_send_email(string $recipient, string $subject, string $text, string $html, array $headers = []): void
{
    foreach ($headers as $headerName => $headerValue) {
        if (preg_match('/^[A-Za-z-]+$/', (string) $headerName) !== 1 || preg_match('/[\r\n]/', (string) $headerValue) === 1) {
            throw new InvalidArgumentException('Invalid e-mail header.');
        }
    }
    $from = orange_smtp_from();
    $socket = orange_smtp_open();

    try {
        orange_smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250], 'MAIL FROM');
        orange_smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251], 'RCPT TO');
        orange_smtp_command($socket, 'DATA', [354], 'DATA');

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $boundary = 'orange-' . bin2hex(random_bytes(16));
        $message = implode("\r\n", [
            'From: Orange <' . $from . '>',
            'To: <' . $recipient . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            ...array_map(static fn(string $key, string $value): string => $key . ': ' . $value, array_keys($headers), array_values($headers)),
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            '',
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            quoted_printable_encode($text),
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            quoted_printable_encode($html),
            '--' . $boundary . '--',
        ]);
        $message = preg_replace('/^\./m', '..', $message) . "\r\n.";
        if (fwrite($socket, $message . "\r\n") === false) {
            throw new RuntimeException('Could not send SMTP message.');
        }
        orange_smtp_read($socket, [250]);
        orange_smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function orange_email_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function orange_email_html(
    string $origin,
    string $name,
    string $preheader,
    string $headline,
    string $highlight,
    string $heroDescription,
    string $bodyText,
    string $buttonLabel,
    string $link,
    string $notice,
): string {
    $safeName = trim($name);
    $greeting = $safeName === ''
        ? 'Olá.'
        : 'Olá, <strong style="color:#151515">' . orange_email_escape($safeName) . '</strong>.';
    $safeLink = orange_email_escape($link);

    $template = <<<'HTML'
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{headline}}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:Arial,Helvetica,sans-serif;color:#151515;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{{preheader}}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f4f1">
<tr><td align="center" style="padding:42px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 50px rgba(20,20,20,.07)">
<tr><td style="padding:18px 34px;border-bottom:1px solid #eee">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td valign="middle"><img src="{{logo}}" width="48" height="48" alt="Logo Bebaorange" style="display:block;width:48px;height:48px;border-radius:12px"></td>
<td valign="middle" style="padding-left:11px;font-size:20px;font-weight:800;letter-spacing:-.8px;color:#151515">bebaorange<span style="color:#ff642d">.</span></td>
</tr></table></td>
<td align="right" valign="middle" style="font-size:10px;letter-spacing:1.8px;color:#888;font-weight:bold">CONTA &amp; SEGURANÇA</td>
</tr></table>
</td></tr>
<tr><td style="padding:38px 34px 35px;background:#ff642d">
<table role="presentation" width="100%"><tr>
<td valign="top">
<div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#451b0e">BEM-VINDO(A) À LARANJA</div>
<h1 style="font-size:42px;line-height:1.02;letter-spacing:-2px;margin:16px 0 12px;color:#171310">{{headline}}<br><span style="color:#fff">{{highlight}}</span></h1>
<p style="font-size:15px;line-height:1.6;color:#3b2116;margin:0;max-width:390px">{{heroDescription}}</p>
</td>
<td width="90" align="right" valign="top"><div style="width:70px;height:70px;line-height:70px;text-align:center;border:1px solid rgba(0,0,0,.22);border-radius:50%;font-size:32px;color:#171310">↗</div></td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 34px 16px">
<p style="font-size:15px;line-height:1.7;color:#454545;margin:0 0 22px">{{greeting}} {{bodyText}}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#171717" style="border-radius:8px">
<a href="{{link}}" style="display:inline-block;padding:16px 23px;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:.2px">{{button}} <span style="color:#ff642d">→</span></a>
</td></tr></table>
<p style="font-size:12px;color:#888;line-height:1.6;margin:17px 0 0">{{notice}}</p>
</td></tr>
<tr><td style="padding:18px 34px 32px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f5f2;border-radius:12px"><tr><td style="padding:20px 22px">
<div style="font-size:14px;font-weight:bold;color:#171717">Precisa de ajuda?</div>
<div style="font-size:12px;line-height:1.5;color:#777;margin-top:5px">Nossa equipe pode ajudar com sua conta.</div>
</td></tr></table>
<p style="font-size:11px;line-height:1.6;color:#999;margin:18px 0 0">Se o botão não abrir, copie este link no navegador:<br><span style="color:#d94a1b;word-break:break-all">{{link}}</span></p>
</td></tr>
<tr><td style="background:#171717;padding:22px 34px">
<table role="presentation" width="100%"><tr>
<td style="font-size:12px;line-height:1.6;color:#aaa">Dúvidas? <a href="mailto:ajuda@bebaorange.com" style="color:#ff8054;text-decoration:none">Fale com nosso time</a></td>
<td align="right" style="font-size:11px;color:#777">© {{year}} Bebaorange</td>
</tr></table>
</td></tr>
</table>
<p style="font-size:10px;color:#aaa;margin:17px 0 0">Mensagem automática de conta e segurança.</p>
</td></tr></table>
</body>
</html>
HTML;

    return strtr($template, [
        '{{preheader}}' => orange_email_escape($preheader),
        '{{logo}}' => orange_email_escape(rtrim($origin, '/') . '/orange-logo.png'),
        '{{headline}}' => orange_email_escape($headline),
        '{{highlight}}' => orange_email_escape($highlight),
        '{{heroDescription}}' => orange_email_escape($heroDescription),
        '{{bodyText}}' => orange_email_escape($bodyText),
        '{{greeting}}' => $greeting,
        '{{button}}' => orange_email_escape($buttonLabel),
        '{{link}}' => $safeLink,
        '{{notice}}' => orange_email_escape($notice),
        '{{year}}' => gmdate('Y'),
    ]);
}

function orange_verification_email_html(string $origin, string $name, string $link): string
{
    return orange_email_html(
        $origin,
        $name,
        'Confirme seu e-mail para ativar sua conta Bebaorange.',
        'Seu próximo passo começa',
        'aqui.',
        'Confirme seu e-mail para ativar sua conta e aproveitar tudo o que preparamos para você.',
        'Recebemos seu pedido de cadastro. Para confirmar que este e-mail é seu, toque no botão:',
        'Confirmar meu e-mail',
        $link,
        'Este link é válido por 24 horas. Se você não iniciou este cadastro, ignore esta mensagem.',
    );
}

function orange_password_reset_email_html(string $origin, string $name, string $link): string
{
    return orange_email_html(
        $origin,
        $name,
        'Redefina com segurança a senha da sua conta Bebaorange.',
        'Sua conta fica segura',
        'com você.',
        'Recupere o acesso à sua conta de forma segura.',
        'Recebemos um pedido para redefinir a senha da sua conta. Se foi você, use o botão abaixo:',
        'Redefinir minha senha',
        $link,
        'Este link é válido por 30 minutos. Se você não pediu a redefinição, ignore esta mensagem; sua senha não será alterada.',
    );
}

function orange_welcome_email_html(string $origin, string $unsubscribeUrl): string
{
    $template = <<<'HTML'
<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Obrigado por se cadastrar na Orange</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" rel="stylesheet"><!--<![endif]-->
<!--[if mso]><style>h1,p,td,a,span,strong{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
body{margin:0!important;padding:0!important;width:100%!important}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
u + #corpo a{color:inherit;text-decoration:none}
[data-ogsc] .cupom{background-color:#FFF4E6!important}
[data-ogsc] .cupom .tinta{color:#111111!important}
[data-ogsc] .cupom .laranja{color:#FF6A00!important}
@media only screen and (max-width:620px){
.wrap{width:100%!important}
.px{padding-left:24px!important;padding-right:24px!important}
.h1{font-size:36px!important;line-height:40px!important}
.big{font-size:50px!important;line-height:54px!important;white-space:nowrap!important}
.col{display:block!important;width:100%!important;padding:0 0 18px 0!important}
.chip{display:block!important;width:100%!important;padding:0 0 8px 0!important}
.btn{display:block!important;text-align:center!important}
}
</style>
</head>
<body id="corpo" style="margin:0;padding:0;background-color:#0B0B0B;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0B0B0B;opacity:0;">
Seu cadastro está confirmado e já garante 10% OFF na sua primeira compra.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0B0B;">
<tr><td align="center" style="padding:24px 12px 32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#111111;border-radius:20px;border:1px solid #241B14;">
<tr><td bgcolor="#1A110B" style="background-color:#1A110B;background-image:linear-gradient(200deg,#5A2208 0%,#2A140A 32%,#111111 70%);border-radius:20px 20px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="px" style="padding:32px 40px 0 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px;"><a href="https://bebaorange.com" target="_blank" style="text-decoration:none;"><img src="{{logo}}" width="32" height="39" alt="Orange" style="display:block;width:32px;height:39px;border:0;color:#FF6A00;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;"></a></td>
<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:18px;font-weight:bold;letter-spacing:3px;color:#FFF4E6;">BEBA&nbsp;ORANGE</td>
</tr></table>
</td></tr>
<tr><td class="px" style="padding:56px 40px 0 40px;">
<p style="margin:0 0 14px 0;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:#FF8A1F;">Cadastro confirmado / Brasília</p>
<h1 class="h1" style="margin:0;font-family:'Archivo Black','Arial Black',Arial,sans-serif;font-weight:900;font-size:46px;line-height:50px;color:#FFF4E6;">Obrigado por se cadastrar<span style="color:#FF6A00;">.</span></h1>
</td></tr>
<tr><td class="px" style="padding:22px 40px 40px 40px;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:18px;line-height:28px;color:#E9DFD2;">
<p style="margin:0 0 14px 0;">Que bom ter você com a gente. Estamos preparando o lançamento da Orange e, em breve, mandamos as novidades por aqui.</p>
<p style="margin:0;">E tem presente: <strong style="color:#FFF4E6;font-weight:600;">o seu cadastro já garante 10% OFF na primeira compra.</strong></p>
</td></tr>
</table>
</td></tr>
<tr><td class="px" style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="cupom" bgcolor="#FFF4E6" style="background-color:#FFF4E6;border-radius:16px;">
<tr><td align="center" style="padding:30px 24px 22px 24px;">
<p style="margin:0 0 6px 0;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:#7A4A26;">Seu cupom de boas-vindas</p>
<p class="big laranja" style="margin:0;font-family:'Archivo Black','Arial Black',Arial,sans-serif;font-weight:900;font-size:80px;line-height:80px;color:#FF6A00;">10% OFF</p>
<p class="tinta" style="margin:8px 0 0 0;font-family:'Fraunces',Georgia,serif;font-size:18px;line-height:24px;color:#111111;">na sua primeira compra</p>
</td></tr>
<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px dashed #E2CBB0;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table></td></tr>
<tr><td align="center" style="padding:16px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#5C4A3A;">
Garantido pelo seu cadastro. O código chega no seu e-mail no dia do lançamento. Válido para uma compra.
</td></tr>
</table>
</td></tr>
<tr><td class="px" style="padding:44px 40px 0 40px;">
<p style="margin:0 0 10px 0;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:#FF8A1F;">O que vem aí</p>
<p style="margin:0 0 18px 0;font-family:'Fraunces',Georgia,serif;font-size:17px;line-height:26px;color:#E9DFD2;">Suco de laranja com colágeno, feito em Brasília. Você retira a sua garrafa gelada nas máquinas automáticas da Orange, sem fila e sem atendente, na hora que quiser.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="chip" width="33%" style="padding:0 4px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid #3A2A1E;border-radius:999px;padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:16px;color:#FFF4E6;"><span style="color:#FF6A00;">&#9679;</span>&nbsp;Laranja espremida</td></tr></table></td>
<td class="chip" width="33%" style="padding:0 2px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid #3A2A1E;border-radius:999px;padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:16px;color:#FFF4E6;"><span style="color:#FF6A00;">&#9679;</span>&nbsp;Com colágeno</td></tr></table></td>
<td class="chip" width="33%" style="padding:0 0 0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid #3A2A1E;border-radius:999px;padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:16px;color:#FFF4E6;"><span style="color:#FF6A00;">&#9679;</span>&nbsp;Garrafa retornável</td></tr></table></td>
</tr></table>
</td></tr>
<tr><td class="px" align="left" style="padding:36px 40px 0 40px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.instagram.com/bebaorange/" style="height:54px;v-text-anchor:middle;width:300px;" arcsize="50%" stroke="f" fillcolor="#FF6A00">
<w:anchorlock/><center style="color:#111111;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Seguir no Instagram</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a class="btn" href="https://www.instagram.com/bebaorange/" target="_blank" style="display:inline-block;background-color:#FF6A00;color:#111111;font-family:'Archivo Black','Arial Black',Arial,sans-serif;font-size:16px;line-height:20px;text-decoration:none;padding:17px 34px;border-radius:999px;mso-hide:all;">Seguir no Instagram <span aria-hidden="true">&#8594;</span></a>
<!--<![endif]-->
</td></tr>
<tr><td class="px" style="padding:22px 40px 40px 40px;font-family:'Fraunces',Georgia,serif;font-size:15px;line-height:22px;color:#BFB6AA;">
As novidades do lançamento saem primeiro por lá. E se conhece alguém que ia gostar, manda <a href="https://bebaorange.com" target="_blank" style="color:#FF8A1F;text-decoration:underline;">bebaorange.com</a> pra essa pessoa garantir os 10% também.
</td></tr>
<tr><td bgcolor="#FF6A00" align="center" style="background-color:#FF6A00;padding:14px 24px;border-radius:0 0 20px 20px;font-family:'Archivo Black','Arial Black',Arial,sans-serif;font-size:13px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:#111111;">
Laranja de verdade &middot; Gelada &middot; Brasília
</td></tr>
</table>
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="px" align="center" style="padding:24px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8A8278;">
<p style="margin:0 0 8px 0;">Orange &middot; Brasília, DF<br>Você recebeu este e-mail porque confirmou seu cadastro em bebaorange.com.</p>
<p style="margin:0;"><a href="https://www.instagram.com/bebaorange/" target="_blank" style="color:#BFB6AA;text-decoration:underline;">Instagram</a> &nbsp;&middot;&nbsp; <a href="{{privacy}}" target="_blank" style="color:#BFB6AA;text-decoration:underline;">Privacidade</a> &nbsp;&middot;&nbsp; <a href="{{unsubscribe}}" target="_blank" style="color:#8A8278;text-decoration:underline;">Não quero mais receber</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
HTML;

    return strtr($template, [
        '{{logo}}' => orange_email_escape(rtrim($origin, '/') . '/orange-logo.png'),
        '{{privacy}}' => orange_email_escape(rtrim($origin, '/') . '/privacidade'),
        '{{unsubscribe}}' => orange_email_escape($unsubscribeUrl),
    ]);
}

function orange_send_welcome_email(string $email, string $unsubscribeUrl): void
{
    $origin = orange_origin();
    orange_send_email(
        $email,
        'Obrigado por se cadastrar na Orange',
        "Seu cadastro está confirmado e já garante 10% OFF na sua primeira compra. O código chega no seu e-mail no dia do lançamento. Válido para uma compra.\n\nSaiba mais em https://bebaorange.com\nNão quero mais receber: {$unsubscribeUrl}",
        orange_welcome_email_html($origin, $unsubscribeUrl),
        [
            'List-Unsubscribe' => '<' . $unsubscribeUrl . '>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ],
    );
}

function orange_send_verification(string $email, string $name, string $link): void
{
    $origin = orange_origin();
    orange_send_email(
        $email,
        'Confirme seu cadastro — Bebaorange',
        "Olá, {$name}. Confirme seu e-mail para ativar sua conta usando este link (válido por 24 horas): {$link}\n\nSe você não iniciou este cadastro, ignore esta mensagem.",
        orange_verification_email_html($origin, $name, $link),
    );
}

function orange_send_password_reset(string $email, string $name, string $link): void
{
    $origin = orange_origin();
    orange_send_email(
        $email,
        'Redefina sua senha — Bebaorange',
        "Olá, {$name}. Recebemos um pedido para redefinir sua senha. Use este link em até 30 minutos: {$link}\n\nSe você não pediu a redefinição, ignore esta mensagem.",
        orange_password_reset_email_html($origin, $name, $link),
    );
}
