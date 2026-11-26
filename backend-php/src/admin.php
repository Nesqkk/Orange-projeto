<?php

declare(strict_types=1);

function orange_plan_payload(array $plan): array
{
    $plan['createdAt'] = orange_iso_date($plan['createdAt']);
    $plan['updatedAt'] = orange_iso_date($plan['updatedAt']);
    $plan['priceInCents'] = (int) $plan['priceInCents'];
    $plan['active'] = (bool) $plan['active'];
    return $plan;
}

function orange_customer_payload(array $customer): array
{
    return [
        'id' => $customer['id'],
        'email' => $customer['email'],
        'name' => $customer['name'],
        'createdAt' => orange_iso_date($customer['createdAt']),
        'emailVerified' => (bool) $customer['emailVerified'],
        'mfaEnabled' => (bool) $customer['mfaEnabled'],
        'google' => (int) $customer['googleCount'] > 0,
        'lastTicketAt' => orange_iso_date($customer['lastTicketAt'] ?? null),
        '_count' => ['tickets' => (int) $customer['ticketCount']],
    ];
}

function orange_admin_customers(string $method, string $path): bool
{
    if ($path === '/api/admin/customers' && $method === 'GET') {
        orange_auth_user(true);
        $statement = orange_db()->query(
            'SELECT u.id, u.email, u.name, u.createdAt, u.emailVerified, u.mfaEnabled,
                    COUNT(t.id) AS ticketCount, MAX(t.updatedAt) AS lastTicketAt,
                    (SELECT COUNT(*) FROM oauth_accounts o WHERE o.userId = u.id AND o.provider = \'GOOGLE\') AS googleCount
             FROM users u LEFT JOIN support_tickets t ON t.userId = u.id
             WHERE u.role = \'CUSTOMER\' GROUP BY u.id, u.email, u.name, u.createdAt, u.emailVerified, u.mfaEnabled
             ORDER BY u.createdAt DESC, u.email ASC',
        );
        $customers = array_map('orange_customer_payload', $statement->fetchAll());
        orange_json(200, $customers);
    }
    if (preg_match('#^/api/admin/customers/([^/]+)$#', $path, $match) === 1 && $method === 'PATCH') {
        orange_auth_user(true);
        $customerId = $match[1];
        if (!orange_valid_uuid($customerId)) {
            orange_fail(400, 'Identificador de cliente inválido.');
        }
        $body = orange_body();
        if (!array_key_exists('name', $body) || !is_string($body['name'])) {
            orange_fail(400, 'O nome do cliente é obrigatório.');
        }
        $name = orange_string($body, 'name');
        if (orange_text_length($name) > 120 || strlen($name) > 480) {
            orange_fail(400, 'O nome pode ter no máximo 120 caracteres.');
        }
        $update = orange_db()->prepare(
            'UPDATE users SET name = ?, updatedAt = ? WHERE id = ? AND role = \'CUSTOMER\'',
        );
        $update->execute([$name === '' ? null : $name, orange_now(), $customerId]);
        $statement = orange_db()->prepare(
            'SELECT u.id, u.email, u.name, u.createdAt, u.emailVerified, u.mfaEnabled,
                    COUNT(t.id) AS ticketCount, MAX(t.updatedAt) AS lastTicketAt,
                    (SELECT COUNT(*) FROM oauth_accounts o WHERE o.userId = u.id AND o.provider = \'GOOGLE\') AS googleCount
             FROM users u LEFT JOIN support_tickets t ON t.userId = u.id
             WHERE u.id = ? AND u.role = \'CUSTOMER\' GROUP BY u.id, u.email, u.name, u.createdAt, u.emailVerified, u.mfaEnabled LIMIT 1',
        );
        $statement->execute([$customerId]);
        $customer = $statement->fetch();
        if (!$customer) {
            orange_fail(404, 'Cliente não encontrado.');
        }
        orange_json(200, orange_customer_payload($customer));
    }
    return false;
}

function orange_plans(string $method, string $path): bool
{
    if ($path === '/api/admin/plans' && $method === 'GET') {
        orange_auth_user(true);
        $statement = orange_db()->query('SELECT * FROM plans ORDER BY createdAt DESC');
        orange_json(200, array_map('orange_plan_payload', $statement->fetchAll()));
    }
    if ($path === '/api/admin/plans' && $method === 'POST') {
        orange_auth_user(true);
        $body = orange_body();
        $name = orange_string($body, 'name');
        $price = $body['priceInCents'] ?? null;
        $interval = orange_string($body, 'interval');
        if (preg_match_all('/./us', $name) < 2 || preg_match_all('/./us', $name) > 120) {
            orange_fail(400, 'O nome precisa ter entre 2 e 120 caracteres.');
        }
        if (!is_int($price) || $price < 0 || $price > 100000000) {
            orange_fail(400, 'O valor do plano é inválido.');
        }
        if (!in_array($interval, ['MONTHLY', 'YEARLY', 'ONCE'], true)) {
            orange_fail(400, 'O intervalo do plano é inválido.');
        }
        $now = orange_now();
        try {
            $insert = orange_db()->prepare(
                'INSERT INTO plans (id, name, priceInCents, `interval`, active, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, true, ?, ?)',
            );
            $insert->execute([orange_uuid(), $name, $price, $interval, $now, $now]);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') {
                orange_fail(409, 'Já existe um plano com esse nome.');
            }
            throw $error;
        }
        $query = orange_db()->prepare('SELECT * FROM plans WHERE name = ? LIMIT 1');
        $query->execute([$name]);
        $plan = $query->fetch();
        if (!$plan) {
            throw new RuntimeException('New plan could not be loaded after insert.');
        }
        orange_json(201, orange_plan_payload($plan));
    }
    if (preg_match('#^/api/admin/plans/([^/]+)$#', $path, $match) === 1 && in_array($method, ['PATCH', 'DELETE'], true)) {
        orange_auth_user(true);
        $planId = $match[1];
        if (!orange_valid_uuid($planId)) {
            orange_fail(400, 'Identificador de plano inválido.');
        }
        if ($method === 'DELETE') {
            $delete = orange_db()->prepare('DELETE FROM plans WHERE id = ?');
            $delete->execute([$planId]);
            if ($delete->rowCount() !== 1) {
                orange_fail(404, 'Plano não encontrado.');
            }
            orange_json(200, ['ok' => true]);
        }

        $body = orange_body();
        $updates = [];
        $parameters = [];
        if (array_key_exists('name', $body)) {
            $name = orange_string($body, 'name');
            if (preg_match_all('/./us', $name) < 2 || preg_match_all('/./us', $name) > 120) {
                orange_fail(400, 'O nome precisa ter entre 2 e 120 caracteres.');
            }
            $updates[] = 'name = ?';
            $parameters[] = $name;
        }
        if (array_key_exists('priceInCents', $body)) {
            $price = $body['priceInCents'];
            if (!is_int($price) || $price < 0 || $price > 100000000) {
                orange_fail(400, 'O valor do plano é inválido.');
            }
            $updates[] = 'priceInCents = ?';
            $parameters[] = $price;
        }
        if (array_key_exists('interval', $body)) {
            $interval = orange_string($body, 'interval');
            if (!in_array($interval, ['MONTHLY', 'YEARLY', 'ONCE'], true)) {
                orange_fail(400, 'O intervalo do plano é inválido.');
            }
            $updates[] = '`interval` = ?';
            $parameters[] = $interval;
        }
        if (array_key_exists('active', $body)) {
            if (!is_bool($body['active'])) {
                orange_fail(400, 'O status do plano é inválido.');
            }
            $updates[] = 'active = ?';
            $parameters[] = $body['active'] ? 1 : 0;
        }
        if ($updates) {
            $updates[] = 'updatedAt = ?';
            $parameters[] = orange_now();
            $parameters[] = $planId;
            try {
                $update = orange_db()->prepare('UPDATE plans SET ' . implode(', ', $updates) . ' WHERE id = ?');
                $update->execute($parameters);
            } catch (PDOException $error) {
                if ((string) $error->getCode() === '23000') {
                    orange_fail(409, 'Já existe um plano com esse nome.');
                }
                throw $error;
            }
        }
        $query = orange_db()->prepare('SELECT * FROM plans WHERE id = ? LIMIT 1');
        $query->execute([$planId]);
        $plan = $query->fetch();
        if (!$plan) {
            orange_fail(404, 'Plano não encontrado.');
        }
        orange_json(200, orange_plan_payload($plan));
    }
    return false;
}
