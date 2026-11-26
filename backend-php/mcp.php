<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name');
header('Access-Control-Expose-Headers: MCP-Protocol-Version, Mcp-Session-Id');
header('Cache-Control: no-store');

function orange_mcp_reply(int $status, mixed $payload, mixed $id): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['jsonrpc' => '2.0', 'id' => $id, 'result' => $payload],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
    );
    exit;
}

function orange_mcp_error(int $status, mixed $id, int $code, string $message): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
    );
    exit;
}

function orange_mcp_pages(): array
{
    return [
        ['title' => 'Início', 'url' => 'https://app.bebaorange.com/', 'description' => 'Conceito, ideias de produto e perguntas frequentes.'],
        ['title' => 'Sobre', 'url' => 'https://app.bebaorange.com/sobre', 'description' => 'Apresentação do projeto Orange.'],
        ['title' => 'Contato', 'url' => 'https://app.bebaorange.com/contato', 'description' => 'Canais de atendimento Orange.'],
        ['title' => 'Privacidade', 'url' => 'https://app.bebaorange.com/privacidade', 'description' => 'Informações sobre dados e privacidade.'],
        ['title' => 'Termos', 'url' => 'https://app.bebaorange.com/termos', 'description' => 'Condições de uso do site e da conta.'],
    ];
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method === 'DELETE') {
    http_response_code(200);
    exit;
}
if ($method !== 'POST') {
    header('Allow: POST, DELETE, OPTIONS');
    http_response_code(405);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 65536) {
    orange_mcp_error(413, null, -32600, 'Invalid request.');
}
try {
    $request = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    orange_mcp_error(400, null, -32700, 'Parse error.');
}
if (!is_array($request) || ($request['jsonrpc'] ?? null) !== '2.0' || !is_string($request['method'] ?? null)) {
    orange_mcp_error(400, is_array($request) ? ($request['id'] ?? null) : null, -32600, 'Invalid request.');
}

$method = $request['method'];
$id = $request['id'] ?? null;
if (!array_key_exists('id', $request) && str_starts_with($method, 'notifications/')) {
    http_response_code(202);
    exit;
}
if (!array_key_exists('id', $request)) {
    orange_mcp_error(400, null, -32600, 'Invalid request.');
}

$version = $_SERVER['HTTP_MCP_PROTOCOL_VERSION'] ?? '2025-03-26';
header('MCP-Protocol-Version: ' . preg_replace('/[^0-9.-]/', '', $version));
$params = is_array($request['params'] ?? null) ? $request['params'] : [];

if ($method === 'initialize') {
    orange_mcp_reply(200, [
        'protocolVersion' => $params['protocolVersion'] ?? '2025-03-26',
        'capabilities' => ['tools' => new stdClass()],
        'serverInfo' => ['name' => 'com.bebaorange/site', 'version' => '1.0.0'],
    ], $id);
}
if ($method === 'ping') {
    orange_mcp_reply(200, new stdClass(), $id);
}
if ($method === 'tools/list') {
    orange_mcp_reply(200, ['tools' => [
        [
            'name' => 'orange_site_overview',
            'description' => 'Returns public information about Orange and identifies which product details are illustrative.',
            'inputSchema' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
        ],
        [
            'name' => 'orange_find_public_page',
            'description' => 'Finds a public Orange page by its topic, such as contact, privacy, terms, or about.',
            'inputSchema' => [
                'type' => 'object',
                'properties' => ['query' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 100]],
                'required' => ['query'],
                'additionalProperties' => false,
            ],
        ],
        [
            'name' => 'orange_support_contact',
            'description' => 'Returns the public Orange support email and contact page URL.',
            'inputSchema' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
        ],
    ]], $id);
}
if ($method === 'tools/call') {
    $name = $params['name'] ?? '';
    $arguments = is_array($params['arguments'] ?? null) ? $params['arguments'] : [];
    if ($name === 'orange_site_overview') {
        $result = [
            'name' => 'Orange',
            'summary' => 'Projeto de marca de bebidas de laranja com uma experiência digital de apresentação.',
            'contact' => 'oi@orange.com.br',
            'note' => 'Os preços, planos e depoimentos exibidos no site são fictícios ou demonstrativos; não representam uma oferta comercial real.',
            'pages' => orange_mcp_pages(),
        ];
    } elseif ($name === 'orange_support_contact') {
        $result = ['email' => 'oi@orange.com.br', 'contactPage' => 'https://app.bebaorange.com/contato'];
    } elseif ($name === 'orange_find_public_page') {
        $query = trim((string) ($arguments['query'] ?? ''));
        if ($query === '' || strlen($query) > 400) {
            orange_mcp_error(200, $id, -32602, 'Invalid query.');
        }
        $needle = function_exists('mb_strtolower') ? mb_strtolower($query, 'UTF-8') : strtolower($query);
        $matches = array_values(array_filter(orange_mcp_pages(), static function (array $page) use ($needle): bool {
            $text = $page['title'] . ' ' . $page['description'];
            $haystack = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
            return str_contains($haystack, $needle);
        }));
        $result = $matches ?: ['message' => 'Nenhuma página pública correspondeu à busca.', 'pages' => orange_mcp_pages()];
    } else {
        orange_mcp_error(200, $id, -32601, 'Unknown tool.');
    }
    orange_mcp_reply(200, [
        'content' => [[
            'type' => 'text',
            'text' => json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]],
    ], $id);
}

orange_mcp_error(200, $id, -32601, 'Method not found.');
