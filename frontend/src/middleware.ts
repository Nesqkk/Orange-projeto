import { NextRequest, NextResponse } from "next/server";

function requestsMarkdown(accept: string | null) {
  return Boolean(accept?.split(",").some((entry) => {
    const [mediaType, ...parameters] = entry.trim().split(";");
    if (mediaType?.trim().toLowerCase() !== "text/markdown") return false;
    const quality = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
    return !quality || Number(quality.trim().slice(2)) > 0;
  }));
}

export function middleware(request: NextRequest) {
  const markdown = requestsMarkdown(request.headers.get("accept"));
  const response = markdown
    ? NextResponse.rewrite(new URL("/markdown/home", request.url))
    : NextResponse.next();

  response.headers.set(
    "Link",
    '<https://bebaorange.com/llms.txt>; rel="alternate"; type="text/plain", <https://bebaorange.com/markdown/home>; rel="alternate"; type="text/markdown", <https://bebaorange.com/sitemap.xml>; rel="sitemap"',
  );
  const vary = response.headers.get("Vary");
  const varyValues = (vary ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!varyValues.some((value) => value.toLowerCase() === "accept") && !varyValues.includes("*")) varyValues.push("Accept");
  if (varyValues.length) response.headers.set("Vary", varyValues.join(", "));
  return response;
}

export const config = { matcher: ["/"] };
