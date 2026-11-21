# Seguridad

## Avisar de un fallo

No abras un issue público. Usa **Security → Report a vulnerability** en GitHub (aviso privado). Cuenta qué encontraste, cómo reproducirlo y qué impacto ves. Respondemos en un máximo de 5 días hábiles.

Puedes probar contra tu propio despliegue con `scripts/pentest.sh`. No lances pruebas de carga ni ataques contra el despliegue público.

## Qué entra

- La API (`worker/`): inyección, saltarse el token, fuga de datos internos, saltarse el límite de ritmo.
- La web (`web/`): XSS, cabeceras, redirecciones abiertas, envenenamiento de caché.
- La cadena de noticias: una noticia que consiga instrucciones en el modelo, enlaces peligrosos o texto que suene a consejo de inversión en pantalla.
- Las micro-interfaces: una especificación que consiga ejecutar código o leer datos que no debe.

## Qué ya hacemos

El detalle, con el resultado del último pentest, está en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).
