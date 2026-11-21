"""Construye el JSON Schema NewsEvent v1 desde la taxonomía, carga 9 noticias reales
(extraídas a mano siguiendo el esquema, como haría el LLM) y calcula de forma
determinística su impacto y la presión de noticias por activo."""
from pathlib import Path
HERE = Path(__file__).resolve().parent
DATA, OUT, SHARED = HERE / "data", HERE / "out", HERE.parent / "shared"
OUT.mkdir(exist_ok=True)
import json, math, hashlib
from datetime import datetime, timedelta, timezone

TAX = json.load(open(SHARED / 'taxonomy.json'))
ET = TAX['event_types']

def build_schema():
    num01 = {"type": "number", "minimum": 0, "maximum": 1}
    num11 = {"type": "number", "minimum": -1, "maximum": 1}
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://luchoia.dev/schemas/news-event-v1.json",
        "title": "NewsEvent v1",
        "description": "Metadatos de una noticia. Bloques llm_* los llena la IA desde el texto; bloques computed_* los llena el Worker con datos de mercado; outcome se llena después y nunca lo ven los inversionistas antes de su horizonte.",
        "type": "object",
        "required": ["schema_version", "event_id", "source", "timing", "content", "entities", "classification", "signal", "extraction"],
        "additionalProperties": False,
        "properties": {
            "schema_version": {"const": "news-event-1.0"},
            "event_id": {"type": "string", "description": "sha256(url canónica + published_at)"},
            "source": {"type": "object", "required": ["name", "url", "tier", "kind"], "additionalProperties": False, "properties": {
                "name": {"type": "string"}, "url": {"type": "string", "format": "uri"}, "domain": {"type": "string"},
                "tier": {"enum": list(TAX['source_tiers'].keys())},
                "kind": {"enum": ["wire", "regulatory_filing", "press_release", "news", "analysis", "blog", "social"]},
                "language": {"type": "string"}, "paywalled": {"type": "boolean"}}},
            "timing": {"type": "object", "required": ["published_at", "time_known", "effective_at"], "additionalProperties": False, "properties": {
                "published_at": {"type": "string", "format": "date-time"},
                "time_known": {"type": "boolean", "description": "false = solo se conoce el día"},
                "first_seen_at": {"type": "string", "format": "date-time"},
                "market_session": {"enum": ["pre", "regular", "post", "closed", "unknown"]},
                "effective_at": {"type": "string", "format": "date-time", "description": "primer momento en que un inversionista puede actuar: calculado por el Worker, nunca por el LLM"}}},
            "content": {"type": "object", "required": ["title", "summary_es"], "additionalProperties": False, "properties": {
                "title": {"type": "string"}, "summary_es": {"type": "string", "maxLength": 400},
                "content_hash": {"type": "string"}, "word_count": {"type": "integer"}}},
            "entities": {"type": "array", "minItems": 1, "items": {"type": "object", "required": ["symbol", "role", "relevance", "sentiment", "confidence"], "additionalProperties": False, "properties": {
                "symbol": {"type": "string"}, "name": {"type": "string"},
                "asset_class": {"enum": TAX['asset_classes']},
                "role": {"enum": TAX['entity_roles']},
                "relevance": num01, "sentiment": num11, "confidence": num01}}},
            "classification": {"type": "object", "required": ["event_type", "themes", "macro_factors"], "additionalProperties": False, "properties": {
                "event_type": {"enum": list(ET.keys())},
                "secondary_event_types": {"type": "array", "items": {"enum": list(ET.keys())}},
                "themes": {"type": "array", "items": {"enum": TAX['themes']}},
                "macro_factors": {"type": "array", "items": {"enum": TAX['macro_factors']}},
                "regions": {"type": "array", "items": {"type": "string"}}}},
            "signal": {"type": "object", "required": ["direction", "surprise", "novelty", "magnitude", "horizon", "hype", "uncertainty"], "additionalProperties": False, "properties": {
                "direction": {"enum": TAX['directions']},
                "surprise": {**num01, "description": "qué tan inesperado vs lo que el mercado ya esperaba"},
                "novelty": {**num01, "description": "1 = primera vez que se informa; 0 = refrito"},
                "magnitude": {"enum": TAX['magnitudes']},
                "horizon": {"enum": list(TAX['horizons'].keys())},
                "hype": {**num01, "description": "lenguaje promocional o sensacionalista"},
                "uncertainty": {**num01, "description": "rumor, fuentes anónimas, hechos sin confirmar"}}},
            "facts": {"type": "array", "description": "cifras textuales extraídas", "items": {"type": "object", "required": ["metric", "value"], "properties": {
                "metric": {"type": "string"}, "value": {"type": "number"}, "unit": {"type": "string"}, "period": {"type": "string"},
                "vs_expectation": {"enum": ["above", "in_line", "below", "unknown"]}}}},
            "credibility": {"type": "object", "additionalProperties": False, "properties": {
                "is_rumor": {"type": "boolean"}, "official_confirmation": {"type": "boolean"}, "corroborating_sources": {"type": "integer"}}},
            "dedup": {"type": "object", "additionalProperties": False, "properties": {
                "cluster_id": {"type": "string"}, "story_rank": {"type": "integer", "description": "1 = primer reporte de la historia"}}},
            "extraction": {"type": "object", "required": ["model", "prompt_version", "taxonomy_version", "anonymized"], "additionalProperties": False, "properties": {
                "provider": {"enum": ["workers-ai", "anthropic", "google", "openai", "manual"]},
                "model": {"type": "string"}, "gateway": {"type": "string"},
                "prompt_version": {"type": "string"}, "taxonomy_version": {"type": "string"},
                "temperature": {"type": "number"}, "anonymized": {"type": "boolean"},
                "extracted_at": {"type": "string", "format": "date-time"}, "cost_usd": {"type": "number"}, "validated": {"type": "boolean"}}},
            "computed_market_context": {"type": "object", "description": "lo llena el Worker con precios hasta effective_at", "properties": {
                "symbol": {"type": "string"}, "ret_1d": {"type": "number"}, "ret_5d": {"type": "number"}, "vol_20d": {"type": "number"}, "vix": {"type": "number"}, "dist_sma50": {"type": "number"}}},
            "outcome": {"type": "object", "description": "etiqueta ex-post para evaluar; prohibido como entrada de decisión", "properties": {
                "ret_1d": {"type": "number"}, "ret_5d": {"type": "number"}, "reaction_divergence": {"type": "boolean"}}}
        }
    }

# --- 9 noticias reales (Firecrawl, búsqueda de noticias con filtro de fecha) ---
# hora: cuando la fuente no da hora exacta, time_known=False y cuenta desde la siguiente apertura (13:30 UTC / 14:30 UTC en invierno)
RAW = [
 dict(src=("NPR","https://www.npr.org/2026/11/05/nx-s1-6031987/stock-markets-ai-midterm-elections","tier2","news"),
      pub="2026-11-05", title="Fears of an AI crackdown after midterms spark $2 trillion rout in tech stocks",
      summary="El Nasdaq cae más de 5% por temor a que un Congreso demócrata frene la IA y los centros de datos.",
      ents=[("QQQ","etf","sector_proxy",0.9,-0.8,0.85),("NVDA","equity","secondary",0.7,-0.6,0.75),("CRWV","equity","secondary",0.7,-0.7,0.7)],
      et="election_policy", sec=["market_selloff"], themes=["regulation_ai","data_centers","ai_capex","us_politics"], mf=["policy_uncertainty","risk_off"],
      sig=("bearish",0.7,0.9,"high","weeks",0.2,0.3), facts=[("nasdaq_drop",5,"%","2026-11-05","unknown"),("market_value_lost",2,"trillion_usd","2026-11-05","unknown")]),
 dict(src=("Reuters","https://www.reuters.com/business/retail-consumer/nvidia-ceo-jensen-huang-step-down-big-blow-ai-boom-2026-11-12/","tier1","wire"),
      pub="2026-11-12", title="Nvidia CEO Jensen Huang resigns in blow to AI boom he helped foster",
      summary="Jensen Huang deja Nvidia tras un escándalo personal con implicaciones de seguridad nacional; la CFO Colette Kress asume como CEO interina.",
      ents=[("NVDA","equity","primary",1.0,-0.75,0.9),("QQQ","etf","sector_proxy",0.5,-0.3,0.6)],
      et="executive_change", sec=["governance_scandal"], themes=["semiconductors","ai_capex","china"], mf=["policy_uncertainty"],
      sig=("bearish",0.9,1.0,"high","weeks",0.2,0.2), facts=[]),
 dict(src=("CNBC","https://www.cnbc.com/2026/11/13/treasury-yields-fed-rates.html","tier2","news"),
      pub="2026-11-13", title="10-year Treasury yield moves to 5.17% as traders weigh producer price report",
      summary="Los precios al productor suben 6,5% anual, el mayor alza desde 2022; el mercado da por segura una subida de tipos de la Fed en diciembre.",
      ents=[("TLT","etf","sector_proxy",0.9,-0.6,0.8),("SPY","etf","sector_proxy",0.5,-0.3,0.6),("QQQ","etf","sector_proxy",0.5,-0.35,0.6)],
      et="inflation_data", sec=["rates_move"], themes=["rates","inflation"], mf=["rates_up","inflation_up","liquidity_tightening"],
      sig=("bearish",0.6,0.8,"medium","days",0.1,0.1), facts=[("us10y_yield",5.17,"%","2026-11-13","unknown"),("ppi_yoy",6.5,"%","oct-2026","above")]),
 dict(src=("Bitbo / Glassnode","https://bitbo.io/news/glassnode-bitcoin-weekly-selloff/","tier3","analysis"),
      pub="2026-11-16", title="Glassnode: Bitcoin Drops 13% as ETF Outflows and Losses Mount",
      summary="Bitcoin cierra la semana cerca de 13% abajo, alrededor de 64.000 USD, con salidas de los ETF y vendedores al mando.",
      ents=[("BTC-USD","crypto","primary",1.0,-0.7,0.8),("COIN","equity","secondary",0.5,-0.4,0.6),("ETH-USD","crypto","competitor",0.4,-0.4,0.5)],
      et="etf_flows", sec=["market_selloff"], themes=["crypto_etf"], mf=["risk_off","liquidity_tightening"],
      sig=("bearish",0.3,0.4,"medium","days",0.2,0.2), facts=[("btc_weekly_change",-13,"%","semana al 15-nov","unknown"),("btc_price",64000,"usd","2026-11-15","unknown")]),
 dict(src=("Forbes","https://www.forbes.com/sites/fionariley/2026/11/17/nvidia-reports-strong-1158-billion-quarterly-revenue-in-first-earnings-post-jensen-huang/","tier2","news"),
      pub="2026-11-17T21:30:00Z", title="Nvidia Earnings: $115.8 Billion In Q3 Revenue Beats Expectations",
      summary="Nvidia reporta ingresos de 115.800 millones en el trimestre y supera las expectativas, en su primer informe sin Jensen Huang.",
      ents=[("NVDA","equity","primary",1.0,0.6,0.8),("CRWV","equity","customer",0.4,0.2,0.5)],
      et="earnings_beat", sec=[], themes=["semiconductors","ai_capex"], mf=[],
      sig=("bullish",0.5,0.9,"high","days",0.2,0.1), facts=[("revenue",115.8,"billion_usd","Q3 FY27","above")]),
 dict(src=("Reuters","https://www.reuters.com/world/india/gold-slides-over-one-year-low-firm-dollar-us-rate-outlook-2026-11-18/","tier1","wire"),
      pub="2026-11-18", title="Gold drops to 14-month low as dollar, yields rise on hawkish Fed rhetoric",
      summary="El oro cae más de 3% a mínimos de 14 meses por señales duras de la Fed; un gobernador pide subir medio punto en diciembre.",
      ents=[("GLD","etf","primary",1.0,-0.7,0.85),("TLT","etf","sector_proxy",0.6,-0.5,0.7)],
      et="central_bank_guidance", sec=["rates_move"], themes=["rates","inflation"], mf=["rates_up","usd_up","liquidity_tightening"],
      sig=("bearish",0.5,0.8,"medium","weeks",0.1,0.15), facts=[("gold_drop",3,"%","2026-11-18","unknown"),("p_50bp_hike",7.3,"%","dic-2026","unknown")]),
 dict(src=("Forbes","https://www.forbes.com/sites/fionariley/2026/11/19/anthropic-ipo-live-shares-pop-34-to-open-at-11150/","tier2","news"),
      pub="2026-11-19T21:05:00Z", title="Anthropic IPO Live: Stock Closes Day At $97—Up More Than 17%",
      summary="Anthropic abre a 111,50 y cierra su primer día a 97,17, un 17% sobre el precio de salida de 83.",
      ents=[("ANT","equity","primary",1.0,0.4,0.75),("SPCX","equity","competitor",0.4,-0.2,0.5)],
      et="ipo_debut", sec=["liquidity_supply"], themes=["mega_ipo","ai_models"], mf=["liquidity_tightening"],
      sig=("mixed",0.4,1.0,"high","days",0.4,0.2), facts=[("ipo_price",83,"usd","2026-11-19","above"),("open",111.5,"usd","2026-11-19","unknown"),("close",97.17,"usd","2026-11-19","unknown")]),
 dict(src=("Reuters","https://www.reuters.com/business/anthropics-post-debut-stumble-delivers-reality-check-ai-trade-2026-11-20/","tier1","wire"),
      pub="2026-11-20T22:00:00Z", title="Anthropic's post-debut stumble delivers reality check for AI trade",
      summary="Anthropic cae en su segundo día y SpaceX baja cerca de 8%; el desarme global de la apuesta por la IA pesa más que el entusiasmo de la salida.",
      ents=[("ANT","equity","primary",1.0,-0.6,0.8),("SPCX","equity","competitor",0.6,-0.5,0.7),("QQQ","etf","sector_proxy",0.5,-0.4,0.6)],
      et="market_selloff", sec=["liquidity_supply"], themes=["mega_ipo","ai_models"], mf=["risk_off","liquidity_tightening"],
      sig=("bearish",0.4,0.8,"medium","days",0.3,0.2), facts=[("spcx_drop",8,"%","2026-11-20","unknown")]),
 dict(src=("Benzinga","https://www.benzinga.com/news/politics/26/11/63514897/schumer-trump-ai-chip-exports-china","tier3","news"),
      pub="2026-11-21T07:25:58Z", title="Schumer critica la aprobación de ventas de chips de IA de Nvidia y AMD a China",
      summary="El líder demócrata del Senado ataca al gobierno por autorizar exportaciones de chips de IA a China; tono político y polémico.",
      ents=[("NVDA","equity","primary",0.8,-0.2,0.5)],
      et="export_controls_trade", sec=["opinion_commentary"], themes=["china","semiconductors","us_politics"], mf=["policy_uncertainty"],
      sig=("bearish",0.3,0.5,"low","weeks",0.6,0.4), facts=[]),
]

US_SESSIONS = None  # se rellena desde los precios en backtest.py

def next_open(dt, sessions):
    """primera apertura (14:30 UTC en invierno, 13:30 en verano) estrictamente posterior a dt"""
    for d in sessions:
        o = datetime.fromisoformat(d).replace(tzinfo=timezone.utc) + timedelta(hours=14, minutes=30)
        if o > dt:
            return o
    return dt + timedelta(days=1)

def make_events(sessions):
    evs = []
    for r in RAW:
        name, url, tier, kind = r['src']
        tk = 'T' in r['pub']
        pub = datetime.fromisoformat(r['pub'].replace('Z', '+00:00')) if tk else datetime.fromisoformat(r['pub']).replace(tzinfo=timezone.utc)
        eff = next_open(pub if tk else pub + timedelta(hours=23, minutes=59), sessions)
        d, s, n, m, h, hy, u = r['sig']
        ev = {
            "schema_version": "news-event-1.0",
            "event_id": hashlib.sha256((url + r['pub']).encode()).hexdigest()[:16],
            "source": {"name": name, "url": url, "domain": url.split('/')[2], "tier": tier, "kind": kind, "language": "en", "paywalled": name in ("Reuters", "Bloomberg")},
            "timing": {"published_at": pub.isoformat().replace('+00:00', 'Z'), "time_known": tk, "market_session": "post" if tk else "unknown", "effective_at": eff.isoformat().replace('+00:00', 'Z')},
            "content": {"title": r['title'], "summary_es": r['summary']},
            "entities": [{"symbol": a, "asset_class": c, "role": ro, "relevance": rel, "sentiment": se, "confidence": co} for a, c, ro, rel, se, co in r['ents']],
            "classification": {"event_type": r['et'], "secondary_event_types": r['sec'], "themes": r['themes'], "macro_factors": r['mf'], "regions": ["US"]},
            "signal": {"direction": d, "surprise": s, "novelty": n, "magnitude": m, "horizon": h, "hype": hy, "uncertainty": u},
            "facts": [{"metric": a, "value": b, "unit": c, "period": p, "vs_expectation": v} for a, b, c, p, v in r['facts']],
            "credibility": {"is_rumor": False, "official_confirmation": tier == "tier1", "corroborating_sources": 3 if tier != "tier3" else 1},
            "extraction": {"provider": "manual", "model": "claude (demo manual en chat)", "gateway": "n/a en la demo; producción: Cloudflare AI Gateway", "prompt_version": "extract-1.0", "taxonomy_version": TAX['version'], "temperature": 0, "anonymized": False, "validated": True},
        }
        evs.append(ev)
    return evs

def impact(ev, ent, at):
    """impacto determinístico de una entidad de un evento en el instante `at` (UTC)."""
    eff = datetime.fromisoformat(ev['timing']['effective_at'].replace('Z', '+00:00'))
    if at < eff:
        return 0.0  # point-in-time: el futuro no existe
    sc = TAX['scoring']
    s = ent['sentiment']
    if abs(s) < sc['dead_zone']:
        return 0.0
    sig = ev['signal']
    w_src = TAX['source_tiers'][ev['source']['tier']]['weight']
    w_evt = ET[ev['classification']['event_type']]['weight']
    hl = TAX['horizons'][sig['horizon']]['half_life_hours']
    age_h = (at - eff).total_seconds() / 3600
    decay = 0.5 ** (age_h / hl)
    val = (s * ent['confidence'] * ent['relevance'] * (0.5 + 0.5 * sig['novelty']) * w_src * w_evt
           * (1 - 0.5 * sig['hype']) * (0.5 + sig['surprise']) * (1 - 0.5 * sig['uncertainty']) * decay)
    return val

def pressure(events, symbol, at):
    tot = 0.0
    for ev in events:
        for ent in ev['entities']:
            if ent['symbol'] == symbol:
                tot += impact(ev, ent, at)
    return math.tanh(tot)
