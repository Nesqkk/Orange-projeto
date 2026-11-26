import type { MetadataRoute } from "next";

const site = "https://app.bebaorange.com";
// Update these dates when the corresponding page content changes.
const lastModified = new Date("2026-11-25T00:00:00.000Z");

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/sobre`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/contato`, lastModified, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/privacidade`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site}/termos`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
