# Vídeos de 1K Monos

Los vídeos están hechos con HTML, CSS y JavaScript y se graban fotograma a fotograma.

- `video.html` — las escenas de los tres vídeos y el motor de la línea de tiempo. Para verlo en el navegador: abre `video.html?v=reel1&play=1` (o `reel2`, `tour`). Clic para pausar.
- `render.mjs` — graba un vídeo: `node media/render.mjs <reel1|reel2|tour> <vertical|horizontal>`. Necesita Playwright y ffmpeg. Deja el MP4 y una portada en `media/out/`.
- `shots.mjs` — vuelve a tomar las capturas de la plataforma que usa el recorrido: `node media/shots.mjs`.

Los vídeos publicados viven en Cloudinary (carpeta `1kmonos/`) y se muestran en `/tutoriales`. Si cambias un dato, vuelve a grabar, sube el archivo con el mismo identificador y la web lo enseña sin más cambios.

Todos los datos de los vídeos son del experimento real. Si el experimento cambia, cambia los guiones.
