# Cómo contribuir

Gracias por querer romper el laboratorio. Es la mejor forma de mejorarlo.

## Qué buscamos

- **Un inversionista nuevo.** Una regla fija, explicable en una frase y sin azar. Abre primero un issue con la plantilla «Nuevo inversionista».
- **Un fallo en el método.** ¿Alguna regla mira el futuro? ¿Falta un coste? ¿El control de suerte está mal? Esto vale oro.
- **Mejor explicación.** Si algo de la web o de los docs no se entiende a la primera, es un bug.
- **Micro-interfaces.** Vistas pequeñas en `web/microui/` (ver el formato en `web/lib/microui.ts`).

## Reglas que no se negocian

Están en [CLAUDE.md](CLAUDE.md). Las tres que más se rompen:

1. **Determinismo.** Nada de `Math.random()` ni `Date.now()` dentro del motor.
2. **Sin mirar el futuro.** La señal se calcula al cierre de t y gana el retorno de t+1.
3. **Paridad.** Si cambias una regla, cámbiala en Python (`research/`) y en TypeScript (`worker/src/engine`), regenera el golden y deja los tests en verde.

Cada variante nueva cuenta como una prueba más en el control de suerte y sube el listón para todos. Por eso pedimos una hipótesis antes del código: qué esperas que pase y por qué.

## Flujo

```bash
git checkout -b mi-cambio
cd worker && npm install && npm run check     # typecheck + tests
cd ../web && npm install && npm run typecheck && npm run build
```

Abre un pull request pequeño, con qué cambia y cómo lo comprobaste. El CI corre los mismos comandos.

## Estilo

- Español en interfaz, docs y mensajes; nombres de campos y taxonomía en inglés.
- Texto de interfaz en lenguaje llano: frases cortas, sin jerga, sin anglicismos innecesarios.
- Nunca texto que aconseje qué hacer con el dinero. El laboratorio describe, no recomienda.

## Conducta

Trata a los demás con respeto y discute las ideas, no a las personas. Ver [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
