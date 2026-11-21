import { getPulse } from "@/lib/api";

/** Pulso del laboratorio para el indicador en vivo. Se cachea 20 s en el borde: mil pestañas, una consulta. */
export async function GET() {
  const { live, status, news } = await getPulse();
  return Response.json(
    {
      live,
      now: new Date().toISOString(),
      market_day: status.market_day?.date ?? null,
      last_news: status.news?.last_published ?? null,
      news_total: status.news?.total ?? 0,
      paper_date: status.paper?.last_date ?? null,
      headline: news[0]?.title ?? null,
    },
    { headers: { "cache-control": "public, max-age=10, s-maxage=20, stale-while-revalidate=60" } },
  );
}
