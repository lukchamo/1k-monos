import type { MetadataRoute } from "next";
import { staticInvestorIds } from "@/lib/api";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/noticias", "/metodo", "/experimentos", "/playground", "/simulador", "/mcp", "/aviso", ...staticInvestorIds().map((id) => `/inversionistas/${id}`)];
  return pages.map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: p === "" || p === "/noticias" ? "hourly" : "daily" }));
}
