import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import queueCache from "@opennextjs/cloudflare/overrides/queue/queue-cache";

/**
 * Caché de la web en Cloudflare:
 * - Caché incremental (ISR) en R2: las páginas se generan una vez y se sirven desde ahí.
 * - Caché regional (Cache API) delante de R2: el HTML ya generado se sirve desde el punto de
 *   presencia sin ir a R2; se refresca en segundo plano.
 * - Cola en Durable Objects: una sola regeneración por página aunque lleguen mil visitas a la vez.
 * - Interceptación de caché: una página en caché se responde sin cargar el servidor de Next.
 * No hay revalidación bajo demanda (revalidateTag), así que no hace falta caché de etiquetas.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived", shouldLazilyUpdateOnCacheHit: true }),
  queue: queueCache(doQueue, { regionalCacheTtlSec: 5, waitForQueueAck: false }),
  enableCacheInterception: true,
});
