/** Capítulos del tutorial interactivo. Las posiciones de los puntos van en % sobre la captura. */
export interface Hotspot {
  x: number;
  y: number;
  title: string;
  text: string;
}
export interface Chapter {
  id: string;
  title: string;
  lead: string;
  image: string;
  href: string;
  cta: string;
  spots: Hotspot[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "ranking",
    title: "Mira el ranking",
    lead: "Cada fila es un inversionista con una regla fija. Las filas amarillas son los monos, que operan al azar. Quedar por encima del mono mediano no demuestra nada.",
    image: "/tutorial/ranking.jpg",
    href: "/#ranking",
    cta: "Abrir el ranking",
    spots: [
      { x: 20, y: 33, title: "Los monos", text: "Son la vara de medir. «El mejor de 28 monos» es lo que se gana por pura suerte probando 28 ideas." },
      { x: 41, y: 41, title: "Resultado", text: "Lo que ganó o perdió cada inversionista en el periodo, con comisiones incluidas." },
      { x: 85, y: 41, title: "¿Es real?", text: "La probabilidad de que la ventaja no sea suerte. Se exige un 95 % para tomársela en serio." },
    ],
  },
  {
    id: "posiciones",
    title: "Mira qué tiene cada uno",
    lead: "Un cuadro por inversionista y activo. Verde: está comprado (largo). Rojo: está vendido en corto. Gris: está fuera.",
    image: "/tutorial/posiciones.jpg",
    href: "/#posiciones",
    cta: "Abrir las posiciones",
    spots: [
      { x: 22, y: 40, title: "Inversionistas", text: "Pulsa un nombre para ver su regla en una frase y por qué decidió así." },
      { x: 50, y: 42, title: "Rojo: en corto", text: "Apuesta a que ese activo baja." },
      { x: 55, y: 60, title: "Verde: en largo", text: "Apuesta a que ese activo sube." },
    ],
  },
  {
    id: "playground",
    title: "Practica en el playground",
    lead: "Una cuenta de práctica con dinero ficticio. Eliges un activo, largo o corto, cuánto pones y si lo multiplicas. Luego avanzas el tiempo y ves qué pasó de verdad.",
    image: "/tutorial/playground.jpg",
    href: "/playground",
    cta: "Abrir el playground",
    spots: [
      { x: 15, y: 32, title: "Qué operar", text: "Bitcoin, Ethereum, Nvidia, oro… con el precio real de ese día." },
      { x: 22, y: 46, title: "Qué hace el laboratorio", text: "Cuántos de los 28 inversionistas están en largo y cuántos en corto en ese activo." },
      { x: 31, y: 56, title: "Largo o corto", text: "Largo si crees que sube. Corto si crees que baja." },
      { x: 58, y: 13, title: "Avanzar el tiempo", text: "Pasa un día o una semana y mira cómo le va a tu posición." },
    ],
  },
  {
    id: "simulador",
    title: "O ponlo en piloto automático",
    lead: "El simulador sigue solo a un inversionista, o a un mono, durante todo el año. Cambia el bróker y el apalancamiento y mira cuánto se llevan los costes.",
    image: "/tutorial/simulador.jpg",
    href: "/simulador",
    cta: "Abrir el simulador",
    spots: [
      { x: 16, y: 26, title: "A quién sigues", text: "Cualquiera de los 28 inversionistas o un mono con su semilla." },
      { x: 14, y: 46, title: "Apalancamiento", text: "De 1× a 5×. Multiplica ganancias y pérdidas, y puede liquidar la cuenta." },
      { x: 55, y: 47, title: "Tu cartera", text: "En amarillo, con costes. En gris, la misma sin costes. Discontinua: comprar todo y esperar." },
    ],
  },
  {
    id: "avisos",
    title: "Activa los avisos",
    lead: "Cuando los inversionistas en largo y en corto se separan con claridad en un activo, el laboratorio lo anota y lo comprueba al día siguiente. Puedes recibir un aviso en tu dispositivo.",
    image: "/tutorial/avisos.jpg",
    href: "/#llamadas",
    cta: "Ver los avisos",
    spots: [
      { x: 42, y: 30, title: "Avísame", text: "Un aviso en este dispositivo, sin correo ni cuenta. En iPhone, añade antes la web a la pantalla de inicio." },
      { x: 42, y: 14, title: "Dónde hay acuerdo", text: "Cada llamada se verifica con el cierre siguiente y queda en una tabla pública." },
    ],
  },
  {
    id: "mcp",
    title: "Pregúntale a tu asistente",
    lead: "El laboratorio tiene un servidor MCP público. Lo añades una vez a Claude, Cursor u otro asistente y le preguntas en lenguaje normal.",
    image: "/tutorial/mcp.jpg",
    href: "/mcp",
    cta: "Ver cómo conectarlo",
    spots: [
      { x: 30, y: 40, title: "La dirección", text: "Es lo único que hay que pegar. No pide usuario ni contraseña." },
      { x: 30, y: 53, title: "Paso a paso", text: "Instrucciones para Claude, Claude Code, Cursor y una prueba con curl." },
    ],
  },
];

export interface VideoItem {
  id: string;
  title: string;
  text: string;
  format: "vertical" | "horizontal";
  seconds: number;
  url: string;
  poster: string;
}

const CDN = "https://res.cloudinary.com/dh26q79sh/video/upload";
const video = (id: string) => `${CDN}/q_auto/1kmonos/${id}.mp4`;
const poster = (id: string, w: number) => `${CDN}/so_3,w_${w},q_auto/1kmonos/${id}.jpg`;

/** Vídeos alojados en Cloudinary. Se generan con media/render.mjs a partir de media/video.html. */
export const VIDEOS: VideoItem[] = [
  { id: "reel-monos-vertical", title: "¿Buena idea o suerte?", text: "Qué son los monos y por qué son el listón que hay que superar.", format: "vertical", seconds: 42, url: video("reel-monos-vertical"), poster: poster("reel-monos-vertical", 540) },
  { id: "reel-caso-real-vertical", title: "Un corto en Ethereum con 50 € de mentira", text: "Un caso real del 19 de noviembre de 2026, paso a paso en el playground.", format: "vertical", seconds: 51, url: video("reel-caso-real-vertical"), poster: poster("reel-caso-real-vertical", 540) },
  { id: "guia-primera-operacion-vertical", title: "Tu primera operación, con 50 € de mentira", text: "Largo, corto, apalancamiento y liquidación, con las cuentas en euros.", format: "vertical", seconds: 61, url: video("guia-primera-operacion-vertical"), poster: poster("guia-primera-operacion-vertical", 540) },
  { id: "tutorial-recorrido", title: "Cómo usar 1K Monos en un minuto", text: "Recorrido por el ranking, las posiciones, el playground, el simulador, los avisos y el MCP.", format: "horizontal", seconds: 44, url: video("tutorial-recorrido"), poster: poster("tutorial-recorrido", 960) },
  { id: "reel-monos-horizontal", title: "¿Buena idea o suerte? (pantalla ancha)", text: "El mismo vídeo de los monos, en formato de escritorio.", format: "horizontal", seconds: 42, url: video("reel-monos-horizontal"), poster: poster("reel-monos-horizontal", 960) },
  { id: "reel-caso-real-horizontal", title: "Un corto en Ethereum (pantalla ancha)", text: "El caso real, en formato de escritorio.", format: "horizontal", seconds: 51, url: video("reel-caso-real-horizontal"), poster: poster("reel-caso-real-horizontal", 960) },
  { id: "guia-primera-operacion-horizontal", title: "Tu primera operación (pantalla ancha)", text: "La guía con números, en formato de escritorio.", format: "horizontal", seconds: 61, url: video("guia-primera-operacion-horizontal"), poster: poster("guia-primera-operacion-horizontal", 960) },
];

/** Guías cortas con cantidades en euros. Los números salen de las reglas del playground. */
export const MONEY_GUIDES: { title: string; steps: string[]; result: string }[] = [
  {
    title: "Tu primer largo, con 50 €",
    steps: ["Abre el playground y elige Bitcoin.", "Pulsa «Largo · sube».", "Escribe 50 y deja el apalancamiento en 1×.", "Pulsa «Abrir largo en BTC» y avanza una semana."],
    result: "Si Bitcoin sube un 10 %, tus 50 € pasan a 55 €. Si baja un 10 %, a 45 €. Lo máximo que puedes perder son tus 50 €.",
  },
  {
    title: "Tu primer corto, con 50 €",
    steps: ["Elige Tesla.", "Pulsa «Corto · baja».", "Escribe 50, con 1×.", "Pulsa «Abrir corto en TSLA» y avanza unos días."],
    result: "Aquí es al revés: si Tesla baja un 10 %, ganas 5 €. Si sube un 10 %, pierdes 5 €. Estar en corto cuesta un poco cada día: con 50 €, alrededor de 1 céntimo.",
  },
  {
    title: "Qué cambia con 5×",
    steps: ["Repite el largo en Bitcoin con 50 €.", "Esta vez marca 5×: operas con 250 €.", "Mira la línea «Te liquidan si llega a».", "Avanza el tiempo y observa cómo se mueve tu patrimonio."],
    result: "El mismo 10 % ahora son 25 €, a favor o en contra. Y si el precio baja un 11 %, se cierra todo y de tus 50 € quedan unos 22 €.",
  },
  {
    title: "Empieza con 200 € y reparte",
    steps: ["Deja el saldo en 200 €.", "Abre cuatro posiciones de 50 € en activos distintos, sin apalancamiento.", "Mezcla: por ejemplo dos largos y dos cortos.", "Avanza un mes y mira «Operaciones cerradas» y los costes pagados."],
    result: "Repartir no garantiza ganar, pero un solo error ya no se lleva toda la cuenta. Abrir y cerrar las cuatro te cuesta unos 20 céntimos en total.",
  },
];
