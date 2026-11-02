import type { MetadataRoute } from "next";

const site = "https://bebaorange.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/sobre`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/contato`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/privacidade`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site}/termos`, changeFrequency: "yearly", priority: 0.4 },
  ];
}
