import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conectar tu asistente (MCP)",
  description: "Cómo conectar Claude, Cursor u otro asistente al laboratorio con el servidor MCP público.",
};

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? "https://laboratorio-inversionistas.lc-45e.workers.dev/mcp";

const TOOLS = [
  ["ranking", "Ranking de inversionistas, global o por segmento, con su percentil frente a los monos.", "¿Quién va primero en cripto?"],
  ["explicar_decision", "Por qué un inversionista tomó una posición en un activo, con los números de su regla.", "¿Por qué el Elástico 10 z1.5 está comprado en NVDA?"],
  ["presion_noticias", "Cuánto empujan las noticias a un activo en un momento dado y cuáles son.", "¿Qué noticias pesan hoy sobre Nvidia?"],
  ["comparar_versiones", "Compara dos corridas inversionista a inversionista.", "Compara la corrida de ayer con la de hoy."],
  ["correr_backtest", "Lanza una corrida nueva. Solo con el token del laboratorio.", "—"],
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-3 text-[0.8rem] leading-relaxed text-ink">
      <code className="num">{children}</code>
    </pre>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2.5 font-medium">
        <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function McpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-8 sm:pt-10">
      <header className="space-y-4">
        <p className="eyebrow">MCP · solo lectura</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Conecta tu asistente al laboratorio</h1>
        <p className="text-ink-2">
          MCP es un estándar para que un asistente de IA use herramientas externas. El laboratorio tiene un servidor MCP público: lo añades una vez y
          después preguntas en lenguaje normal («¿quién va primero?», «¿por qué vendió Tesla?») y el asistente consulta los datos reales.
        </p>
        <div className="space-y-1.5">
          <p className="text-sm text-ink-3">Dirección del servidor</p>
          <Code>{MCP_URL}</Code>
        </div>
      </header>

      <Step n="1" title="En Claude (web, escritorio o móvil)">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
          <li>Abre <strong className="text-ink">Ajustes → Conectores</strong>.</li>
          <li>Pulsa <strong className="text-ink">Añadir conector personalizado</strong>.</li>
          <li>Ponle un nombre, por ejemplo «1K Monos», y pega la dirección de arriba.</li>
          <li>Guarda. No pide usuario ni contraseña.</li>
        </ol>
      </Step>

      <Step n="2" title="En Claude Code (terminal)">
        <Code>{`claude mcp add --transport http 1k-monos ${MCP_URL}`}</Code>
        <p className="text-sm text-ink-2">Comprueba que quedó conectado con <code className="num text-ink">/mcp</code> dentro de Claude Code.</p>
      </Step>

      <Step n="3" title="En Cursor, VS Code u otro cliente">
        <p className="text-sm text-ink-2">Añade esto a su archivo de servidores MCP (en Cursor, <code className="num text-ink">.cursor/mcp.json</code>):</p>
        <Code>{`{
  "mcpServers": {
    "1k-monos": {
      "url": "${MCP_URL}"
    }
  }
}`}</Code>
      </Step>

      <Step n="4" title="Pruébalo sin instalar nada">
        <p className="text-sm text-ink-2">Desde una terminal, pide la lista de herramientas:</p>
        <Code>{`curl -X POST ${MCP_URL} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</Code>
        <p className="text-sm text-ink-2">Y el ranking de un segmento:</p>
        <Code>{`curl -X POST ${MCP_URL} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"ranking","arguments":{"segmento":"Cripto"}}}'`}</Code>
      </Step>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Qué puede hacer</h2>
        <ul className="space-y-2.5">
          {TOOLS.map(([name, what, ask]) => (
            <li key={name} className="card p-4">
              <p className="num text-sm text-brand">{name}</p>
              <p className="mt-1 text-sm text-ink-2">{what}</p>
              {ask !== "—" ? <p className="mt-1.5 text-sm text-ink-3">Prueba a preguntar: «{ask}»</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2 p-4 text-sm text-ink-2 sm:p-5">
        <h2 className="font-medium text-ink">Lo que conviene saber</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Es de solo lectura para todo el mundo. Lanzar corridas exige un token que solo tiene quien mantiene el laboratorio.</li>
          <li>Hay un límite de 30 consultas por minuto por conexión. Si lo superas, espera un minuto.</li>
          <li>Cada respuesta incluye el aviso: es un experimento, no una recomendación de inversión. Tu asistente tampoco debería presentarlo como tal.</li>
          <li>
            Los contratos exactos de cada herramienta están en{" "}
            <a className="underline underline-offset-2 hover:text-ink" href={`${SITE.repo}/blob/main/docs/MCP.md`} target="_blank" rel="noreferrer">docs/MCP.md</a>.
          </li>
        </ul>
      </section>
    </div>
  );
}
