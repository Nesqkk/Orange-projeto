import type { MetadataRoute } from "next";

const site = "https://bebaorange.com";
const homeLastModified = new Date("2026-11-04");
const informationPagesLastModified = new Date("2026-11-02");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, lastModified: homeLastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/sobre`, lastModified: informationPagesLastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/contato`, lastModified: informationPagesLastModified, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/privacidade`, lastModified: informationPagesLastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site}/termos`, lastModified: informationPagesLastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
