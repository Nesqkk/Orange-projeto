<?php

declare(strict_types=1);

function orange_ticket_payload(string $ticketId, bool $includeUser): array
{
    $statement = orange_db()->prepare('SELECT * FROM support_tickets WHERE id = ? LIMIT 1');
    $statement->execute([$ticketId]);
    $ticket = $statement->fetch();
    if (!$ticket) {
        orange_fail(404, 'Solicitação não encontrada.');
    }

    if ($includeUser) {
        $userQuery = orange_db()->prepare('SELECT id, email, name FROM users WHERE id = ? LIMIT 1');
        $userQuery->execute([$ticket['userId']]);
        $ticket['user'] = $userQuery->fetch();
    }

    $messages = orange_db()->prepare(
        'SELECT m.id, m.ticketId, m.authorId, m.content, m.createdAt,
                u.id AS authorUserId, u.email AS authorEmail, u.name AS authorName, u.role AS authorRole
         FROM ticket_messages m JOIN users u ON u.id = m.authorId
         WHERE m.ticketId = ? ORDER BY m.createdAt ASC',
    );
    $messages->execute([$ticketId]);
    $ticket['messages'] = array_map(static function (array $message): array {
        return [
            'id' => $message['id'],
            'ticketId' => $message['ticketId'],
            'authorId' => $message['authorId'],
            'content' => $message['content'],
            'createdAt' => orange_iso_date($message['createdAt']),
            'author' => [
                'id' => $message['authorUserId'],
                'email' => $message['authorEmail'],
                'name' => $message['authorName'],
                'role' => $message['authorRole'],
            ],
        ];
    }, $messages->fetchAll());
    $ticket['createdAt'] = orange_iso_date($ticket['createdAt']);
    $ticket['updatedAt'] = orange_iso_date($ticket['updatedAt']);
    return $ticket;
}

function orange_ticket_list(string $whereSql, array $parameters, bool $includeUser): array
{
    $statement = orange_db()->prepare(
        'SELECT t.id FROM support_tickets t ' . $whereSql . ' ORDER BY t.updatedAt DESC',
    );
    $statement->execute($parameters);
    $tickets = [];
    foreach ($statement->fetchAll(PDO::FETCH_COLUMN) as $ticketId) {
        $tickets[] = orange_ticket_payload((string) $ticketId, $includeUser);
    }
    return $tickets;
}

function orange_create_ticket(array $user, array $body): never
{
    orange_rate_limit('support:create', 5, 60);
    if ($user['role'] !== 'CUSTOMER') {
        orange_fail(403, 'Somente clientes podem abrir chamados.');
    }
    $subject = orange_string($body, 'subject');
    $content = orange_string($body, 'content');
    if (preg_match_all('/./us', $subject) < 4 || preg_match_all('/./us', $subject) > 160) {
        orange_fail(400, 'O assunto precisa ter entre 4 e 160 caracteres.');
    }
    if (preg_match_all('/./us', $content) < 10 || preg_match_all('/./us', $content) > 4000) {
        orange_fail(400, 'A mensagem precisa ter entre 10 e 4000 caracteres.');
    }

    $db = orange_db();
    $ticketId = orange_uuid();
    $now = orange_now();
    $db->beginTransaction();
    try {
        $insertTicket = $db->prepare(
            'INSERT INTO support_tickets (id, userId, subject, status, createdAt, updatedAt)
             VALUES (?, ?, ?, \'OPEN\', ?, ?)',
        );
        $insertTicket->execute([$ticketId, $user['id'], $subject, $now, $now]);
        $insertMessage = $db->prepare(
            'INSERT INTO ticket_messages (id, ticketId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
        );
        $insertMessage->execute([orange_uuid(), $ticketId, $user['id'], $content, $now]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    orange_json(201, orange_ticket_payload($ticketId, true));
}

function orange_add_ticket_message(array $user, string $ticketId, array $body): never
{
    orange_rate_limit('support:message', 10, 60);
    if (!orange_valid_uuid($ticketId)) {
        orange_fail(400, 'Identificador de solicitação inválido.');
    }
    $content = orange_string($body, 'content');
    $length = preg_match_all('/./us', $content);
    if ($length < 2 || $length > 4000) {
        orange_fail(400, 'A mensagem precisa ter entre 2 e 4000 caracteres.');
    }
    $statement = orange_db()->prepare('SELECT id, userId, status FROM support_tickets WHERE id = ? LIMIT 1');
    $statement->execute([$ticketId]);
    $ticket = $statement->fetch();
    if (!$ticket || ($user['role'] !== 'ADMIN' && $ticket['userId'] !== $user['id'])) {
        orange_fail(404, 'Solicitação não encontrada.');
    }
    if ($ticket['status'] === 'CLOSED') {
        orange_fail(403, 'Esta solicitação foi encerrada.');
    }

    $nextStatus = $ticket['status'];
    if ($user['role'] === 'ADMIN' && $ticket['status'] === 'OPEN') {
        $nextStatus = 'IN_PROGRESS';
    } elseif ($user['role'] === 'CUSTOMER' && $ticket['status'] === 'RESOLVED') {
        $nextStatus = 'OPEN';
    }
    $db = orange_db();
    $db->beginTransaction();
    try {
        $insert = $db->prepare(
            'INSERT INTO ticket_messages (id, ticketId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
        );
        $insert->execute([orange_uuid(), $ticketId, $user['id'], $content, orange_now()]);
        $update = $db->prepare('UPDATE support_tickets SET status = ?, updatedAt = ? WHERE id = ?');
        $update->execute([$nextStatus, orange_now(), $ticketId]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
    orange_json(200, orange_ticket_payload($ticketId, true));
}

function orange_support_route(string $method, string $path): bool
{
    if ($path === '/api/support/tickets' && $method === 'GET') {
        $user = orange_auth_user();
        orange_json(200, orange_ticket_list('WHERE t.userId = ?', [$user['id']], false));
    }
    if ($path === '/api/support/tickets' && $method === 'POST') {
        orange_create_ticket(orange_auth_user(), orange_body());
    }
    if (preg_match('#^/api/support/tickets/([^/]+)$#', $path, $match) === 1 && $method === 'GET') {
        $user = orange_auth_user();
        $ticketId = $match[1];
        if (!orange_valid_uuid($ticketId)) {
            orange_fail(400, 'Identificador de solicitação inválido.');
        }
        $ticket = orange_ticket_payload($ticketId, true);
        if ($user['role'] !== 'ADMIN' && $ticket['userId'] !== $user['id']) {
            orange_fail(404, 'Solicitação não encontrada.');
        }
        orange_json(200, $ticket);
    }
    if (preg_match('#^/api/support/tickets/([^/]+)/messages$#', $path, $match) === 1 && $method === 'POST') {
        orange_add_ticket_message(orange_auth_user(), $match[1], orange_body());
    }
    if ($path === '/api/admin/operations/tickets' && $method === 'GET') {
        orange_auth_user(true);
        orange_json(200, orange_ticket_list('', [], true));
    }
    if (preg_match('#^/api/admin/operations/tickets/([^/]+)/status$#', $path, $match) === 1 && $method === 'PATCH') {
        orange_auth_user(true);
        $ticketId = $match[1];
        if (!orange_valid_uuid($ticketId)) {
            orange_fail(400, 'Identificador de solicitação inválido.');
        }
        $body = orange_body();
        $status = orange_string($body, 'status');
        if (!in_array($status, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], true)) {
            orange_fail(400, 'Status de solicitação inválido.');
        }
        $update = orange_db()->prepare('UPDATE support_tickets SET status = ?, updatedAt = ? WHERE id = ?');
        $update->execute([$status, orange_now(), $ticketId]);
        if ($update->rowCount() === 0) {
            $check = orange_db()->prepare('SELECT id FROM support_tickets WHERE id = ? LIMIT 1');
            $check->execute([$ticketId]);
            if (!$check->fetch()) {
                orange_fail(404, 'Solicitação não encontrada.');
            }
        }
        orange_json(200, orange_ticket_payload($ticketId, true));
    }
    return false;
}
