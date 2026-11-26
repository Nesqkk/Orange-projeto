<?php

declare(strict_types=1);

// Resumo do painel administrativo: clientes, atendimento, planos e cadastros dos últimos 30 dias.

function orange_admin_overview(string $method, string $path): bool
{
    // Diagnóstico do e-mail: conecta, faz login e testa remetente/destinatário sem enviar nada.
    if ($path === '/api/admin/smtp-check' && $method === 'GET') {
        $admin = orange_auth_user(true);
        orange_rate_limit('smtp-check', 5, 60);
        orange_json(200, orange_smtp_check($admin['email']));
    }
    if ($path !== '/api/admin/overview' || $method !== 'GET') {
        return false;
    }
    orange_auth_user(true);
    $db = orange_db();
    $since30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
    $since7 = gmdate('Y-m-d H:i:s', time() - 7 * 86400);

    $customers = $db->prepare(
        'SELECT COUNT(*) AS total,
                COALESCE(SUM(createdAt >= ?), 0) AS last30,
                COALESCE(SUM(createdAt >= ?), 0) AS last7,
                COALESCE(SUM(emailVerified = true), 0) AS verified,
                COALESCE(SUM(mfaEnabled = true), 0) AS mfa
         FROM users WHERE role = \'CUSTOMER\'',
    );
    $customers->execute([$since30, $since7]);
    $customerStats = array_map('intval', $customers->fetch());
    $customerStats['google'] = (int) $db->query(
        'SELECT COUNT(DISTINCT o.userId) FROM oauth_accounts o JOIN users u ON u.id = o.userId
         WHERE o.provider = \'GOOGLE\' AND u.role = \'CUSTOMER\'',
    )->fetchColumn();

    $tickets = ['OPEN' => 0, 'IN_PROGRESS' => 0, 'RESOLVED' => 0, 'CLOSED' => 0];
    foreach ($db->query('SELECT status, COUNT(*) AS total FROM support_tickets GROUP BY status')->fetchAll() as $row) {
        $tickets[$row['status']] = (int) $row['total'];
    }
    // Chamados ativos cuja última mensagem é do cliente: estão esperando a equipe.
    $tickets['awaitingReply'] = (int) $db->query(
        'SELECT COUNT(*) FROM support_tickets t
         WHERE t.status IN (\'OPEN\', \'IN_PROGRESS\')
           AND (SELECT u.role FROM ticket_messages m JOIN users u ON u.id = m.authorId
                WHERE m.ticketId = t.id ORDER BY m.createdAt DESC LIMIT 1) = \'CUSTOMER\'',
    )->fetchColumn();

    $plans = $db->query('SELECT COUNT(*) AS total, COALESCE(SUM(active = true), 0) AS active FROM plans')->fetch();

    $signups = [];
    for ($day = 29; $day >= 0; $day--) {
        $signups[gmdate('Y-m-d', time() - $day * 86400)] = 0;
    }
    $daily = $db->prepare(
        'SELECT DATE(createdAt) AS day, COUNT(*) AS total FROM users
         WHERE role = \'CUSTOMER\' AND createdAt >= ? GROUP BY DATE(createdAt)',
    );
    $daily->execute([gmdate('Y-m-d 00:00:00', time() - 29 * 86400)]);
    foreach ($daily->fetchAll() as $row) {
        if (isset($signups[$row['day']])) {
            $signups[$row['day']] = (int) $row['total'];
        }
    }

    $recentTickets = $db->query(
        'SELECT t.id, t.subject, t.status, t.updatedAt, u.name, u.email
         FROM support_tickets t JOIN users u ON u.id = t.userId
         ORDER BY t.updatedAt DESC LIMIT 5',
    )->fetchAll();
    $recentCustomers = $db->query(
        'SELECT id, name, email, createdAt, emailVerified FROM users
         WHERE role = \'CUSTOMER\' ORDER BY createdAt DESC LIMIT 5',
    )->fetchAll();

    orange_json(200, [
        'customers' => $customerStats,
        'tickets' => $tickets,
        'plans' => ['total' => (int) $plans['total'], 'active' => (int) $plans['active']],
        'signups' => array_map(
            static fn(string $day, int $total): array => ['day' => $day, 'total' => $total],
            array_keys($signups),
            array_values($signups),
        ),
        'recentTickets' => array_map(static fn(array $ticket): array => [
            'id' => $ticket['id'],
            'subject' => $ticket['subject'],
            'status' => $ticket['status'],
            'updatedAt' => orange_iso_date($ticket['updatedAt']),
            'customer' => $ticket['name'] ?: $ticket['email'],
        ], $recentTickets),
        'recentCustomers' => array_map(static fn(array $customer): array => [
            'id' => $customer['id'],
            'name' => $customer['name'],
            'email' => $customer['email'],
            'createdAt' => orange_iso_date($customer['createdAt']),
            'emailVerified' => (bool) $customer['emailVerified'],
        ], $recentCustomers),
    ]);
}
