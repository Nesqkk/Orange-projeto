const serverCard = {
  "$schema": "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
  name: "com.bebaorange/site",
  version: "1.0.0",
  title: "Orange — informações públicas do site",
  description: "Read-only tools for site overview, public page search, and contact information.",
  websiteUrl: "https://bebaorange.com/",
  repository: {
    url: "https://github.com/Nesqkk/Orange-projeto",
    source: "github",
  },
  remotes: [
    {
      type: "streamable-http",
      url: "https://bebaorange.com/mcp",
      supportedProtocolVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
    },
  ],
  _meta: {
    "com.bebaorange/site": {
      capabilities: {
        readOnly: true,
        tools: [
          { name: "orange_site_overview", description: "Returns public site information and identifies illustrative product details." },
          { name: "orange_find_public_page", description: "Finds public pages by topic, including about, contact, privacy, and terms." },
          { name: "orange_support_contact", description: "Returns the public support email and contact page URL." },
        ],
      },
    },
  },
};

export function GET() {
  return Response.json(serverCard, {
    headers: {
      "Content-Type": "application/mcp-server-card+json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
