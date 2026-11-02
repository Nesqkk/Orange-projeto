"use client";

import { useWebMCP } from "use-webmcp-tool";

const pages = [
  { title: "Início", url: "https://bebaorange.com/", description: "Conceito, produtos em estudo e perguntas frequentes." },
  { title: "Sobre", url: "https://bebaorange.com/sobre", description: "Apresentação do projeto Orange." },
  { title: "Contato", url: "https://bebaorange.com/contato", description: "Canais de atendimento Orange." },
  { title: "Privacidade", url: "https://bebaorange.com/privacidade", description: "Informações sobre dados e privacidade." },
  { title: "Termos", url: "https://bebaorange.com/termos", description: "Condições de uso do site e da conta." },
];

export default function WebMcpTools() {
  useWebMCP({
    name: "orange_site_overview",
    description: "Returns public information about Orange and identifies which product details are illustrative.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => ({
      name: "Orange",
      summary: "Projeto de marca de bebidas de laranja com uma experiência digital de apresentação.",
      contact: "oi@orange.com.br",
      note: "Os preços, planos e depoimentos exibidos no site são fictícios ou demonstrativos; não representam uma oferta comercial real.",
      pages,
    }),
  });

  useWebMCP({
    name: "orange_find_public_page",
    description: "Finds a public Orange page by its topic, such as contact, privacy, terms, or about.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Topic or page name to find." } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: ({ query }: { query: string }) => {
      const normalized = typeof query === "string" ? query.trim().toLocaleLowerCase("pt-BR") : "";
      if (!normalized) return { error: "Informe o assunto da página que deseja localizar." };
      const matches = pages.filter((page) => `${page.title} ${page.description}`.toLocaleLowerCase("pt-BR").includes(normalized));
      return matches.length ? matches : { message: "Nenhuma página pública correspondeu à busca.", pages };
    },
  });

  useWebMCP({
    name: "orange_support_contact",
    description: "Returns the public Orange support contact and the contact page URL.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => ({ email: "oi@orange.com.br", contactPage: "https://bebaorange.com/contato" }),
  });

  return null;
}
