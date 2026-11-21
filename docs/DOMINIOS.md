# Dominios

Consulta de disponibilidad hecha el 21-nov-2026 contra el registro (vía la API de dominios de Vercel). **No se ha comprado nada.** La disponibilidad cambia: confirma en el registrador antes de pagar. No pudimos obtener precios en esta consulta.

## Recomendación

1. **`1kmonos.com`** — libre. Coincide con el repositorio y el nombre del proyecto. Es el principal.
2. **`1kmonos.dev`** — libre. Buen segundo dominio para un proyecto de código abierto (HTTPS obligatorio por diseño). Úsalo para la API o redirígelo al .com.
3. **`1kmonos.org`** — libre. Encaja con «laboratorio abierto y educativo»; defensivo.

Si el nombre va a ser en inglés para llegar a más gente: `1kmonkeys.dev`, `1kmonkeys.org` y `1kmonkeys.ai` están libres; **`1kmonkeys.com` está ocupado**.

Cloudflare Registrar vende a precio de coste y deja el DNS en la misma cuenta que los Workers, así que conectar el dominio es un paso (ver [DESPLIEGUE.md](DESPLIEGUE.md)). Comprueba allí que la extensión elegida esté soportada.

## Tabla completa

| Dominio | Estado |
| --- | --- |
| 1kmonos.com / .dev / .org / .ai / .app / .io / .co / .net / .xyz / .es / .eu / .me / .sh / .lat / .fyi / .fun / .lol / .wtf / .club / .tech / .finance / .markets | Libres |
| 1k-monos.com / 1k-monos.dev | Libres |
| milmonos.com | **Ocupado** |
| milmonos.net | **Ocupado** |
| milmonos.dev / .org / .ai / .app / .co / .io / .es / .eu / .xyz / .lat | Libres |
| monoslab.com | **Ocupado** |
| monoslab.dev / .ai / .org | Libres |
| labmonos.com / labmonos.dev | Libres |
| 1kmonkeys.com | **Ocupado** |
| 1kmonkeys.dev / .ai / .org | Libres |
| 2kmonos.com / 2kmonos.dev | Libres |
| monosvsmercado.com | Libre |
| monos.fyi | Libre |

## Subdominios propuestos (sobre el dominio que se compre)

| Subdominio | Para qué |
| --- | --- |
| `1kmonos.com` | La web |
| `api.1kmonos.com` | La API pública y el MCP |
| `docs.1kmonos.com` | Opcional: documentación |

Mientras no haya dominio, todo vive en `*.lc-45e.workers.dev`. También puede colgarse ya de un dominio que CooWeb tiene en Cloudflare (por ejemplo `monos.cooweb.co`).

## Antes de comprar

- «1K Monos» dice mil y el experimento usa 2.000 monos. Como marca funciona; `2kmonos.com` está libre si se prefiere exactitud.
- Las extensiones `.finance` y `.markets` sugieren un servicio financiero. Para un laboratorio que insiste en que no asesora, mejor evitarlas.
