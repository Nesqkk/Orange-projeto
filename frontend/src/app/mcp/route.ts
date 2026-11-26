import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

const publicPages = [
  { title: "Início", url: "https://bebaorange.com/", description: "Conceito, ideias de produto e perguntas frequentes." },
  { title: "Sobre", url: "https://bebaorange.com/sobre", description: "Apresentação do projeto Orange." },
  { title: "Contato", url: "https://bebaorange.com/contato", description: "Canais de atendimento Orange." },
  { title: "Privacidade", url: "https://bebaorange.com/privacidade", description: "Informações sobre dados e privacidade." },
  { title: "Termos", url: "https://bebaorange.com/termos", description: "Condições de uso do site e da conta." },
];

const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "com.bebaorange/site", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool("orange_site_overview", {
    description: "Returns public information about Orange and identifies which product details are illustrative.",
    inputSchema: z.object({}),
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify({
      name: "Orange",
      summary: "Projeto de marca de bebidas de laranja com uma experiência digital de apresentação.",
      contact: "oi@orange.com.br",
      note: "Os preços, planos e depoimentos exibidos no site são fictícios ou demonstrativos; não representam uma oferta comercial real.",
      pages: publicPages,
    }) }],
  }));

  server.registerTool("orange_find_public_page", {
    description: "Finds a public Orange page by its topic, such as contact, privacy, terms, or about.",
    inputSchema: z.object({ query: z.string().trim().min(1).max(100) }),
  }, async ({ query }) => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    const matches = publicPages.filter((page) => `${page.title} ${page.description}`.toLocaleLowerCase("pt-BR").includes(normalized));
    return {
      content: [{ type: "text", text: JSON.stringify(matches.length ? matches : { message: "Nenhuma página pública correspondeu à busca.", pages: publicPages }) }],
    };
  });

  server.registerTool("orange_support_contact", {
    description: "Returns the public Orange support email and contact page URL.",
    inputSchema: z.object({}),
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify({ email: "oi@orange.com.br", contactPage: "https://bebaorange.com/contato" }) }],
  }));

  return server;
});

async function withCors(request: Request) {
  const response = await handler.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name");
  headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, Mcp-Session-Id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withCors;
export const POST = withCors;
export const DELETE = withCors;
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
    },
  });
}
