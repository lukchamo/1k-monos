/**
 * NewsEvent v1 (shared/news_event.schema.json). La IA llena lo que sale del texto;
 * el Worker llena `timing.effective_at`, `dedup`, `extraction` y `computed_market_context`.
 * `outcome` se llena después y está PROHIBIDO como entrada de decisión.
 */
export interface NewsEntity {
  symbol: string;
  name?: string;
  asset_class?: string;
  role: string;
  relevance: number; // 0–1
  sentiment: number; // −1–1
  confidence: number; // 0–1
}

export interface NewsEvent {
  schema_version: "news-event-1.0";
  event_id: string;
  source: { name: string; url: string; domain?: string; tier: string; kind: string; language?: string; paywalled?: boolean };
  timing: { published_at: string; time_known: boolean; first_seen_at?: string; market_session?: string; effective_at: string };
  content: { title: string; summary_es: string; content_hash?: string; word_count?: number };
  entities: NewsEntity[];
  classification: { event_type: string; secondary_event_types?: string[]; themes?: string[]; macro_factors?: string[]; regions?: string[] };
  signal: { direction: string; surprise: number; novelty: number; magnitude: string; horizon: string; hype: number; uncertainty: number };
  facts?: { metric: string; value: number | string; unit?: string; period?: string; vs_expectation?: string }[];
  credibility?: { is_rumor: boolean; official_confirmation: boolean; corroborating_sources: number };
  extraction: Record<string, unknown>;
  outcome?: Record<string, unknown>;
}
