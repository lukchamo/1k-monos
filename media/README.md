# Vídeos de 1K Monos

Los vídeos están hechos con HTML, CSS y JavaScript y se graban fotograma a fotograma.

- `video.html` — las escenas de los tres vídeos y el motor de la línea de tiempo. Para verlo en el navegador: abre `video.html?v=reel1&play=1` (o `reel2`, `guia`, `tour`). Clic para pausar.
- `render.mjs` — graba un vídeo: `node media/render.mjs <reel1|reel2|guia|tour> <vertical|horizontal>`. Necesita Playwright y ffmpeg. Deja el MP4 y una portada en `media/out/`.
- `voice.py` — ajusta la narración a las escenas. La voz se genera en ElevenLabs (voz «Andres - Social Media Host», modelo eleven_v4) con una pausa entre escenas; el guion de cada vídeo es el texto de sus escenas dicho en voz alta. Deja el audio en `voice/<vídeo>.mp3` y las duraciones en `voice/timings.json`; `render.mjs` los usa solo si existen.
- `shots.mjs` — vuelve a tomar las capturas de la plataforma que usa el recorrido: `node media/shots.mjs`.

Los vídeos publicados viven en Cloudinary (carpeta `1kmonos/`) y se muestran en `/tutoriales`. Si cambias un dato, vuelve a grabar, sube el archivo con el mismo identificador y la web lo enseña sin más cambios.

Todos los datos de los vídeos son del experimento real. Si el experimento cambia, cambia los guiones.
