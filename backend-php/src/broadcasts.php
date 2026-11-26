<?php

declare(strict_types=1);

// Comunicados por e-mail: o admin escreve a mensagem, escolhe categoria e layout e envia para todos
// os clientes com e-mail confirmado que não pediram para sair da lista. O envio acontece em lotes
// pequenos chamados pelo painel, para caber no tempo de execução da hospedagem compartilhada.

const ORANGE_BROADCAST_BATCH = 12;

const ORANGE_BROADCAST_CATEGORIES = [
    'NEWS' => ['label' => 'NOVIDADE', 'accent' => '#ff642d'],
    'PROMO' => ['label' => 'PROMOÇÃO', 'accent' => '#ff642d'],
    'NOTICE' => ['label' => 'AVISO IMPORTANTE', 'accent' => '#171717'],
    'UPDATE' => ['label' => 'ATUALIZAÇÃO', 'accent' => '#ff642d'],
];

const ORANGE_BROADCAST_LAYOUTS = ['HIGHLIGHT', 'LETTER', 'OFFER'];

function orange_broadcast_input(array $body): array
{
    $field = static fn(string $key): string => orange_string($body, $key);
    $input = [
        'subject' => $field('subject'),
        'category' => $field('category'),
        'layout' => $field('layout'),
        'headline' => $field('headline'),
        'highlight' => $field('highlight'),
        'body' => isset($body['body']) && is_string($body['body']) ? trim(str_replace("\r\n", "\n", $body['body'])) : '',
        'imageUrl' => $field('imageUrl'),
        'ctaLabel' => $field('ctaLabel'),
        'ctaUrl' => $field('ctaUrl'),
    ];
    $length = static fn(string $value): int => orange_text_length($value);
    if ($length($input['subject']) < 3 || $length($input['subject']) > 160) {
        orange_fail(400, 'O assunto precisa ter entre 3 e 160 caracteres.');
    }
    if (!isset(ORANGE_BROADCAST_CATEGORIES[$input['category']])) {
        orange_fail(400, 'Escolha uma categoria válida.');
    }
    if (!in_array($input['layout'], ORANGE_BROADCAST_LAYOUTS, true)) {
        orange_fail(400, 'Escolha um layout válido.');
    }
    if ($length($input['headline']) < 2 || $length($input['headline']) > 120) {
        orange_fail(400, 'O título precisa ter entre 2 e 120 caracteres.');
    }
    if ($length($input['highlight']) > 80) {
        orange_fail(400, 'O destaque pode ter no máximo 80 caracteres.');
    }
    if ($length($input['body']) < 10 || $length($input['body']) > 8000) {
        orange_fail(400, 'A mensagem precisa ter entre 10 e 8000 caracteres.');
    }
    foreach (['imageUrl' => 'imagem', 'ctaUrl' => 'botão'] as $key => $label) {
        if ($input[$key] !== '' && (strlen($input[$key]) > 500 || !orange_broadcast_https_url($input[$key]))) {
            orange_fail(400, "O link da {$label} precisa começar com https://.");
        }
    }
    if ($length($input['ctaLabel']) > 60) {
        orange_fail(400, 'O texto do botão pode ter no máximo 60 caracteres.');
    }
    if (($input['ctaLabel'] === '') !== ($input['ctaUrl'] === '')) {
        orange_fail(400, 'Para usar o botão, preencha o texto e o link.');
    }
    return $input;
}

function orange_broadcast_https_url(string $url): bool
{
    $parts = parse_url($url);
    return is_array($parts) && strtolower($parts['scheme'] ?? '') === 'https' && !empty($parts['host'])
        && !isset($parts['user']) && !isset($parts['pass']) && preg_match('/[\s"<>]/', $url) !== 1;
}

function orange_unsubscribe_token(string $email): string
{
    return substr(hash_hmac('sha256', 'unsubscribe:' . strtolower($email), orange_mfa_key()), 0, 40);
}

function orange_unsubscribe_url(string $email): string
{
    return orange_api_origin() . '/api/email/unsubscribe?' . http_build_query([
        'e' => rtrim(strtr(base64_encode(strtolower($email)), '+/', '-_'), '='),
        't' => orange_unsubscribe_token($email),
    ], '', '&', PHP_QUERY_RFC3986);
}

function orange_first_name(?string $name): string
{
    $name = trim((string) $name);
    return $name === '' ? '' : (preg_split('/\s+/u', $name)[0] ?? '');
}

/** Monta o HTML do comunicado. Todo texto vindo do painel é escapado; só {{nome}} é personalizado. */
function orange_broadcast_html(array $b, string $name, string $unsubscribeUrl): string
{
    $e = 'orange_email_escape';
    $first = orange_first_name($name);
    $personalize = static fn(string $value): string => str_replace(['{{nome}}', '{{ nome }}'], $first !== '' ? $first : 'cliente', $value);
    $category = ORANGE_BROADCAST_CATEGORIES[$b['category']];
    $origin = orange_origin();
    $logo = $e($origin . '/orange-logo-96.png');

    $paragraphs = '';
    foreach (preg_split("/\n{2,}/", $personalize($b['body'])) ?: [] as $paragraph) {
        $paragraphs .= '<p style="font-size:15px;line-height:1.7;color:#454545;margin:0 0 16px">'
            . nl2br($e(trim($paragraph)), false) . '</p>';
    }
    $headline = $e($personalize($b['headline']));
    $highlight = $b['highlight'] !== '' ? $e($personalize($b['highlight'])) : '';
    $image = $b['imageUrl'] !== ''
        ? '<tr><td style="padding:0"><img src="' . $e($b['imageUrl']) . '" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>'
        : '';
    $dark = $b['layout'] === 'OFFER';
    $buttonBg = $dark ? '#ff642d' : '#171717';
    $button = $b['ctaUrl'] !== ''
        ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px"><tr><td bgcolor="' . $buttonBg . '" style="border-radius:999px">'
            . '<a href="' . $e($b['ctaUrl']) . '" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:bold">'
            . $e($b['ctaLabel']) . ' <span style="color:' . ($dark ? '#171717' : '#ff642d') . '">→</span></a></td></tr></table>'
        : '';

    $hero = match ($b['layout']) {
        'HIGHLIGHT' => '<tr><td style="padding:40px 34px 36px;background:#ff642d">'
            . '<div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#451b0e">' . $e($category['label']) . '</div>'
            . '<h1 style="font-size:40px;line-height:1.04;letter-spacing:-1.6px;margin:16px 0 0;color:#171310">' . $headline
            . ($highlight !== '' ? '<br><span style="color:#fff">' . $highlight . '</span>' : '') . '</h1></td></tr>',
        'OFFER' => '<tr><td align="center" style="padding:44px 34px 38px;background:#171717">'
            . '<div style="display:inline-block;padding:7px 13px;border:1px solid #ff642d;border-radius:999px;font-size:10px;letter-spacing:2px;font-weight:bold;color:#ff8054">' . $e($category['label']) . '</div>'
            . ($highlight !== '' ? '<div style="font-size:54px;line-height:1;letter-spacing:-2px;font-weight:800;color:#ff642d;margin:22px 0 10px">' . $highlight . '</div>' : '<div style="height:18px"></div>')
            . '<h1 style="font-size:26px;line-height:1.2;letter-spacing:-.6px;margin:0;color:#fff">' . $headline . '</h1></td></tr>',
        default => '<tr><td style="padding:38px 34px 0">'
            . '<div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:' . $category['accent'] . '">' . $e($category['label']) . '</div>'
            . '<h1 style="font-size:30px;line-height:1.15;letter-spacing:-1px;margin:14px 0 0;color:#151515">' . $headline
            . ($highlight !== '' ? ' <span style="color:#ff642d">' . $highlight . '</span>' : '') . '</h1>'
            . '<div style="width:48px;height:3px;background:#ff642d;border-radius:3px;margin:22px 0 0"></div></td></tr>',
    };
    $greeting = $first !== '' ? 'Olá, <strong style="color:#151515">' . $e($first) . '</strong>.' : 'Olá.';
    $flat = preg_replace('/\s+/u', ' ', $personalize($b['body'])) ?? '';
    $preheader = $e(preg_replace('/^(.{110}).+$/us', '$1…', $flat) ?? '');

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="light"><title>' . $e($b['subject']) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f5f4f1;font-family:Arial,Helvetica,sans-serif;color:#151515">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' . $preheader . '</div>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f4f1"><tr><td align="center" style="padding:36px 14px">'
        . '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border-radius:22px;overflow:hidden">'
        . '<tr><td style="padding:18px 34px;border-bottom:1px solid #eee"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>'
        . '<td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle"><img src="' . $logo . '" width="40" height="40" alt="Orange" style="display:block;width:40px;height:40px;border-radius:50%"></td>'
        . '<td valign="middle" style="padding-left:10px;font-size:19px;font-weight:800;letter-spacing:-.6px;color:#151515">orange<span style="color:#ff642d">.</span></td></tr></table></td>'
        . '<td align="right" valign="middle" style="font-size:10px;letter-spacing:1.8px;color:#888;font-weight:bold">' . $e($category['label']) . '</td></tr></table></td></tr>'
        . $hero . $image
        . '<tr><td style="padding:30px 34px 34px"><p style="font-size:15px;line-height:1.7;color:#454545;margin:0 0 16px">' . $greeting . '</p>' . $paragraphs . $button . '</td></tr>'
        . '<tr><td style="background:#171717;padding:22px 34px"><table role="presentation" width="100%"><tr>'
        . '<td style="font-size:12px;line-height:1.6;color:#aaa">Orange · O lado mais vivo da sua rotina<br><a href="' . $e($origin) . '" style="color:#ff8054;text-decoration:none">' . $e(parse_url($origin, PHP_URL_HOST) ?: $origin) . '</a></td>'
        . '<td align="right" style="font-size:11px;color:#777">© ' . gmdate('Y') . ' Orange</td></tr></table></td></tr>'
        . '</table><p style="font-size:11px;line-height:1.6;color:#999;margin:16px 0 0">Você recebe este e-mail porque tem uma conta Orange. '
        . '<a href="' . $e($unsubscribeUrl) . '" style="color:#d94a1b">Não quero mais receber comunicados</a>.</p>'
        . '</td></tr></table></body></html>';
}

function orange_broadcast_text(array $b, string $name, string $unsubscribeUrl): string
{
    $first = orange_first_name($name);
    $personalize = static fn(string $value): string => str_replace(['{{nome}}', '{{ nome }}'], $first !== '' ? $first : 'cliente', $value);
    $lines = [
        ($first !== '' ? "Olá, {$first}." : 'Olá.'),
        '',
        trim($personalize($b['headline']) . ' ' . $personalize($b['highlight'])),
        '',
        $personalize($b['body']),
    ];
    if ($b['ctaUrl'] !== '') {
        $lines[] = '';
        $lines[] = $b['ctaLabel'] . ': ' . $b['ctaUrl'];
    }
    $lines[] = '';
    $lines[] = 'Para não receber mais comunicados: ' . $unsubscribeUrl;
    return implode("\n", $lines);
}

function orange_broadcast_send_one(array $broadcast, string $email, string $name): void
{
    // Campos opcionais vêm do banco como NULL.
    foreach (['highlight', 'imageUrl', 'ctaLabel', 'ctaUrl'] as $key) {
        $broadcast[$key] = (string) ($broadcast[$key] ?? '');
    }
    $unsubscribe = orange_unsubscribe_url($email);
    orange_send_email(
        $email,
        $broadcast['subject'],
        orange_broadcast_text($broadcast, $name, $unsubscribe),
        orange_broadcast_html($broadcast, $name, $unsubscribe),
        [
            'List-Unsubscribe' => '<' . $unsubscribe . '>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ],
    );
}

function orange_broadcast_audience_sql(): string
{
    return 'FROM users u WHERE u.role = \'CUSTOMER\' AND u.emailVerified = true
            AND NOT EXISTS (SELECT 1 FROM email_unsubscribes x WHERE x.email = u.email)';
}

function orange_broadcast_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'subject' => $row['subject'],
        'category' => $row['category'],
        'layout' => $row['layout'],
        'headline' => $row['headline'],
        'status' => $row['status'],
        'total' => (int) $row['total'],
        'sent' => (int) $row['sent'],
        'failed' => (int) $row['failed'],
        'pending' => (int) $row['pending'],
        'createdAt' => orange_iso_date($row['createdAt']),
        'finishedAt' => orange_iso_date($row['finishedAt']),
    ];
}

function orange_broadcast_get(string $id): array
{
    $statement = orange_db()->prepare(
        'SELECT b.*,
                COALESCE(SUM(r.status = \'SENT\'), 0) AS sent,
                COALESCE(SUM(r.status = \'FAILED\'), 0) AS failed,
                COALESCE(SUM(r.status IN (\'PENDING\', \'CLAIMED\')), 0) AS pending
         FROM broadcasts b LEFT JOIN broadcast_recipients r ON r.broadcastId = b.id
         WHERE b.id = ? GROUP BY b.id',
    );
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) {
        orange_fail(404, 'Comunicado não encontrado.');
    }
    return $row;
}

/** Envia o próximo lote. Reserva as linhas com um token para dois painéis abertos não mandarem em dobro. */
function orange_broadcast_send_batch(string $id): array
{
    $db = orange_db();
    $broadcast = orange_broadcast_get($id);
    if ($broadcast['status'] !== 'SENDING') {
        return orange_broadcast_payload($broadcast);
    }
    $release = $db->prepare(
        'UPDATE broadcast_recipients SET status = \'PENDING\', claimToken = NULL, claimedAt = NULL
         WHERE broadcastId = ? AND status = \'CLAIMED\' AND claimedAt < ?',
    );
    $release->execute([$id, gmdate('Y-m-d H:i:s', time() - 5 * 60)]);

    $token = bin2hex(random_bytes(16));
    $claim = $db->prepare(
        'UPDATE broadcast_recipients SET status = \'CLAIMED\', claimToken = ?, claimedAt = ?
         WHERE broadcastId = ? AND status = \'PENDING\' ORDER BY email LIMIT ' . ORANGE_BROADCAST_BATCH,
    );
    $claim->execute([$token, orange_now(), $id]);
    $rows = $db->prepare('SELECT userId, email, name FROM broadcast_recipients WHERE broadcastId = ? AND claimToken = ?');
    $rows->execute([$id, $token]);

    $mark = $db->prepare('UPDATE broadcast_recipients SET status = ?, sentAt = ?, claimToken = NULL WHERE broadcastId = ? AND userId = ?');
    $unsubscribed = $db->prepare('SELECT 1 FROM email_unsubscribes WHERE email = ? LIMIT 1');
    $failuresInRow = 0;
    $stopped = false;
    foreach ($rows->fetchAll() as $recipient) {
        if ($stopped) {
            $mark->execute(['PENDING', null, $id, $recipient['userId']]);
            continue;
        }
        $unsubscribed->execute([$recipient['email']]);
        if ($unsubscribed->fetchColumn()) {
            $mark->execute(['FAILED', orange_now(), $id, $recipient['userId']]);
            continue;
        }
        try {
            orange_broadcast_send_one($broadcast, $recipient['email'], (string) $recipient['name']);
            $mark->execute(['SENT', orange_now(), $id, $recipient['userId']]);
            $failuresInRow = 0;
        } catch (Throwable $error) {
            error_log('Orange broadcast: falha ao enviar (' . get_class($error) . ').');
            $failuresInRow++;
            // Três falhas seguidas indicam limite ou problema no SMTP: devolve o restante para a fila.
            if ($failuresInRow >= 3) {
                $stopped = true;
                $mark->execute(['PENDING', null, $id, $recipient['userId']]);
            } else {
                $mark->execute(['FAILED', orange_now(), $id, $recipient['userId']]);
            }
        }
    }

    $current = orange_broadcast_get($id);
    if ((int) $current['pending'] === 0) {
        $finish = $db->prepare('UPDATE broadcasts SET status = \'SENT\', finishedAt = ? WHERE id = ? AND status = \'SENDING\'');
        $finish->execute([orange_now(), $id]);
        $current = orange_broadcast_get($id);
    }
    $payload = orange_broadcast_payload($current);
    $payload['paused'] = $stopped;
    return $payload;
}

function orange_unsubscribe_page(string $title, string $message, string $form = ''): never
{
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'");
    $e = 'orange_email_escape';
    echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $e($title) . '</title></head>'
        . '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070707;color:#f5f3ed;font-family:ui-monospace,Menlo,monospace">'
        . '<main style="max-width:440px;padding:32px;text-align:center"><p style="color:#ff6b18;letter-spacing:2px;font-size:11px">ORANGE · COMUNICADOS</p>'
        . '<h1 style="font-family:Arial Black,Arial,sans-serif;font-size:28px;margin:12px 0">' . $e($title) . '</h1>'
        . '<p style="color:#9b9992;line-height:1.6">' . $e($message) . '</p>' . $form . '</main></body></html>';
    exit;
}

/** Descadastro: GET mostra a confirmação (leitores de link não descadastram ninguém); POST confirma. */
function orange_unsubscribe_route(string $method, string $path): bool
{
    if ($path !== '/api/email/unsubscribe' || !in_array($method, ['GET', 'POST'], true)) {
        return false;
    }
    $encoded = isset($_GET['e']) && is_string($_GET['e']) ? $_GET['e'] : '';
    $token = isset($_GET['t']) && is_string($_GET['t']) ? $_GET['t'] : '';
    $email = $encoded !== '' ? orange_base64url_decode($encoded) : false;
    if (!is_string($email) || !orange_validate_email($email) || $token === '' || !hash_equals(orange_unsubscribe_token($email), $token)) {
        orange_unsubscribe_page('Link inválido', 'Este link de descadastro não é válido. Use o link mais recente que você recebeu por e-mail.');
    }
    if ($method === 'POST') {
        orange_rate_limit('unsubscribe', 20, 60);
        $insert = orange_db()->prepare('INSERT IGNORE INTO email_unsubscribes (email, createdAt) VALUES (?, ?)');
        $insert->execute([strtolower($email), orange_now()]);
        orange_unsubscribe_page('Pronto.', 'Você não vai mais receber comunicados da Orange. E-mails da sua conta, como redefinição de senha, continuam chegando.');
    }
    $action = orange_email_escape('/api/email/unsubscribe?' . http_build_query(['e' => $encoded, 't' => $token], '', '&', PHP_QUERY_RFC3986));
    orange_unsubscribe_page(
        'Parar de receber comunicados?',
        'O endereço ' . $email . ' deixará de receber novidades e promoções da Orange.',
        '<form method="post" action="' . $action . '"><button type="submit" style="margin-top:12px;padding:14px 22px;border:0;border-radius:999px;background:#ff6b18;color:#fff;font:inherit;font-weight:bold;cursor:pointer">Sim, parar de receber</button></form>',
    );
}

function orange_broadcast_route(string $method, string $path): bool
{
    if (!str_starts_with($path, '/api/admin/broadcasts')) {
        return false;
    }
    $admin = orange_auth_user(true);
    $db = orange_db();

    if ($path === '/api/admin/broadcasts' && $method === 'GET') {
        $audience = (int) $db->query('SELECT COUNT(*) ' . orange_broadcast_audience_sql())->fetchColumn();
        $unsubscribed = (int) $db->query('SELECT COUNT(*) FROM email_unsubscribes')->fetchColumn();
        $rows = $db->query(
            'SELECT b.*,
                    COALESCE(SUM(r.status = \'SENT\'), 0) AS sent,
                    COALESCE(SUM(r.status = \'FAILED\'), 0) AS failed,
                    COALESCE(SUM(r.status IN (\'PENDING\', \'CLAIMED\')), 0) AS pending
             FROM broadcasts b LEFT JOIN broadcast_recipients r ON r.broadcastId = b.id
             GROUP BY b.id ORDER BY b.createdAt DESC LIMIT 50',
        )->fetchAll();
        orange_json(200, [
            'audience' => $audience,
            'unsubscribed' => $unsubscribed,
            'smtpReady' => orange_smtp_configured(),
            'broadcasts' => array_map('orange_broadcast_payload', $rows),
        ]);
    }
    if ($path === '/api/admin/broadcasts/preview' && $method === 'POST') {
        $input = orange_broadcast_input(orange_body());
        orange_json(200, ['html' => orange_broadcast_html($input, (string) ($admin['name'] ?? ''), orange_origin())]);
    }
    if ($path === '/api/admin/broadcasts/test' && $method === 'POST') {
        orange_rate_limit('broadcast-test', 5, 60);
        $input = orange_broadcast_input(orange_body());
        $input['subject'] = '[Teste] ' . $input['subject'];
        orange_broadcast_send_one($input, $admin['email'], (string) ($admin['name'] ?? ''));
        orange_json(200, ['ok' => true, 'email' => $admin['email']]);
    }
    if ($path === '/api/admin/broadcasts' && $method === 'POST') {
        orange_rate_limit('broadcast-create', 5, 60);
        if (!orange_smtp_configured()) {
            orange_fail(503, 'O envio de e-mail ainda não está configurado no servidor.');
        }
        $input = orange_broadcast_input(orange_body());
        $id = orange_uuid();
        $db->beginTransaction();
        try {
            $insert = $db->prepare(
                'INSERT INTO broadcasts (id, subject, category, layout, headline, highlight, body, imageUrl, ctaLabel, ctaUrl, status, total, createdBy, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'SENDING\', 0, ?, ?)',
            );
            $insert->execute([
                $id, $input['subject'], $input['category'], $input['layout'], $input['headline'],
                $input['highlight'] ?: null, $input['body'], $input['imageUrl'] ?: null,
                $input['ctaLabel'] ?: null, $input['ctaUrl'] ?: null, $admin['id'], orange_now(),
            ]);
            $recipients = $db->prepare(
                'INSERT INTO broadcast_recipients (broadcastId, userId, email, name)
                 SELECT ?, u.id, u.email, u.name ' . orange_broadcast_audience_sql(),
            );
            $recipients->execute([$id]);
            $total = $recipients->rowCount();
            if ($total === 0) {
                orange_fail(409, 'Nenhum cliente com e-mail confirmado para receber o comunicado.');
            }
            $update = $db->prepare('UPDATE broadcasts SET total = ? WHERE id = ?');
            $update->execute([$total, $id]);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
        orange_json(201, orange_broadcast_payload(orange_broadcast_get($id)));
    }
    if (preg_match('#^/api/admin/broadcasts/([^/]+)/(send|cancel)$#', $path, $match) === 1 && $method === 'POST') {
        if (!orange_valid_uuid($match[1])) {
            orange_fail(400, 'Identificador de comunicado inválido.');
        }
        if ($match[2] === 'cancel') {
            $cancel = $db->prepare('UPDATE broadcasts SET status = \'CANCELLED\', finishedAt = ? WHERE id = ? AND status = \'SENDING\'');
            $cancel->execute([orange_now(), $match[1]]);
            orange_json(200, orange_broadcast_payload(orange_broadcast_get($match[1])));
        }
        if (function_exists('set_time_limit')) {
            @set_time_limit(120);
        }
        orange_json(200, orange_broadcast_send_batch($match[1]));
    }
    orange_fail(404, 'Rota não encontrada.');
}
