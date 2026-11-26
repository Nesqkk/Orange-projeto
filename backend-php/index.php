<?php

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

// Log de erros privado (bloqueado no .htaccess): sem ele, a hospedagem não guarda o motivo das falhas.
$orangeLogDir = __DIR__ . '/logs';
if (!is_dir($orangeLogDir)) {
    @mkdir($orangeLogDir, 0750, true);
}
ini_set('log_errors', '1');
ini_set('error_log', $orangeLogDir . '/php-error.log');

// Erros fatais (que não viram exceção) também respondem em JSON e ficam registrados.
register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        return;
    }
    error_log(sprintf('Orange API fatal: %s in %s:%d', $error['message'], basename($error['file']), $error['line']));
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode(['message' => 'Erro interno no servidor (código F' . $error['line'] . '). Tente novamente em instantes.'], JSON_UNESCAPED_UNICODE);
});

require_once __DIR__ . '/src/common.php';
require_once __DIR__ . '/src/mailer.php';
require_once __DIR__ . '/src/auth.php';
require_once __DIR__ . '/src/oauth.php';
require_once __DIR__ . '/src/support.php';
require_once __DIR__ . '/src/admin.php';
require_once __DIR__ . '/src/admin-overview.php';
require_once __DIR__ . '/src/broadcasts.php';

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($path)) {
        orange_fail(400, 'Caminho da solicitação inválido.');
    }
    // O descadastro vem de links em e-mails e do botão de um clique do Gmail, não do painel:
    // fica fora do CORS e da checagem de origem. A autorização é o token assinado no link.
    orange_unsubscribe_route($method, $path);

    orange_cors();
    if (in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && !hash_equals(orange_origin(), rtrim($origin, '/'))) {
            orange_fail(403, 'Origem não autorizada.');
        }
    }

    if ($method === 'GET' && $path === '/api/health') {
        orange_db()->query('SELECT 1');
        orange_json(200, ['status' => 'ok', 'database' => 'connected']);
    }
    orange_auth_route($method, $path);
    orange_support_route($method, $path);
    orange_admin_overview($method, $path);
    orange_broadcast_route($method, $path);
    orange_admin_customers($method, $path);
    orange_plans($method, $path);
    orange_fail(404, 'Rota não encontrada.');
} catch (OrangeApiError $error) {
    orange_json($error->status, ['message' => $error->getMessage()]);
} catch (PDOException $error) {
    // A mensagem do PDO pode citar a consulta, nunca a senha do banco: vai só para o log privado.
    error_log('Orange API database error [' . $error->getCode() . ']: ' . $error->getMessage() . ' @ ' . ($path ?? '?'));
    orange_json(500, ['message' => 'Não foi possível concluir a solicitação agora (código DB' . $error->getCode() . ').']);
} catch (Throwable $error) {
    error_log('Orange API internal error: ' . get_class($error) . ': ' . $error->getMessage() . ' in ' . basename($error->getFile()) . ':' . $error->getLine() . ' @ ' . ($path ?? '?'));
    orange_json(500, ['message' => 'Não foi possível concluir a solicitação agora (código E' . $error->getLine() . ').']);
}
