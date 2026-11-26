const serverCard = {
  "$schema": "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
  name: "com.bebaorange/site",
  version: "1.0.0",
  title: "Orange — informações públicas do site",
  description: "Read-only access to Orange public site information and page links.",
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
};

export function GET() {
  return Response.json(serverCard, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
