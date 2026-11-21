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
const poster = (id: string, w: number) => `${CDN}/so_2.2,w_${w},q_auto/1kmonos/${id}.jpg`;

/** Vídeos alojados en Cloudinary. Se generan con media/render.mjs a partir de media/video.html. */
export const VIDEOS: VideoItem[] = [
  { id: "reel-monos-vertical", title: "¿Buena idea o suerte?", text: "Qué son los monos y por qué son el listón que hay que superar.", format: "vertical", seconds: 27, url: video("reel-monos-vertical"), poster: poster("reel-monos-vertical", 540) },
  { id: "reel-caso-real-vertical", title: "Un corto en Ethereum con 50 € de mentira", text: "Un caso real del 19 de noviembre de 2026, paso a paso en el playground.", format: "vertical", seconds: 33, url: video("reel-caso-real-vertical"), poster: poster("reel-caso-real-vertical", 540) },
  { id: "tutorial-recorrido", title: "Cómo usar 1K Monos en un minuto", text: "Recorrido por el ranking, las posiciones, el playground, el simulador, los avisos y el MCP.", format: "horizontal", seconds: 44, url: video("tutorial-recorrido"), poster: poster("tutorial-recorrido", 960) },
  { id: "reel-monos-horizontal", title: "¿Buena idea o suerte? (pantalla ancha)", text: "El mismo vídeo de los monos, en formato de escritorio.", format: "horizontal", seconds: 27, url: video("reel-monos-horizontal"), poster: poster("reel-monos-horizontal", 960) },
  { id: "reel-caso-real-horizontal", title: "Un corto en Ethereum (pantalla ancha)", text: "El caso real, en formato de escritorio.", format: "horizontal", seconds: 33, url: video("reel-caso-real-horizontal"), poster: poster("reel-caso-real-horizontal", 960) },
];
