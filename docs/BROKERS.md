# Brókers con API o MCP para operar

Consulta hecha el 21-nov-2026 para un cliente minorista en España que quiere automatizar una estrategia con poco capital (unos 200 €), en largo y en corto y con apalancamiento. **Es una investigación, no una recomendación.** Cada dato lleva su fuente; lo que no se pudo confirmar está marcado.

## Resumen

- **Neverless no tiene API pública ni MCP** que hayamos encontrado. Su web, su página de precios y sus preguntas frecuentes no los mencionan. No es una negativa oficial: no revisamos su Discord ni la app.
- **Los que mejor encajan** con poco capital, largo y corto, apalancamiento y un MCP oficial que ejecuta órdenes:
  1. **Capital.com** (CFDs sobre acciones, índices, cripto y metales). API REST oficial y MCP oficial de código abierto que abre, modifica y cierra posiciones; usa la cuenta demo por defecto. Depósito mínimo publicado: 10 €.
  2. **Kraken Pro**. API oficial y un MCP oficial con cripto al contado, futuros y modo de práctica. Perpetuos regulados para el EEE con hasta 10×.
- **eToro** tiene API pública con cuenta real y demo, pero no pudimos confirmar que su MCP ejecute órdenes ni que España esté entre los países admitidos.
- **Alpaca e Interactive Brokers** tienen las API más maduras, pero encajan mal: el MCP de IBKR solo redacta la instrucción y ambos piden en torno a 2.000 $ para margen y cortos (este último dato no se verificó hoy).

## Tabla

| Bróker | API oficial para operar | MCP oficial que opera | España, minorista | Cortos y apalancamiento | Demo |
| --- | --- | --- | --- | --- | --- |
| Neverless | No encontrada | No encontrado | Sí | Sí en la app, hasta 5× | No encontrada |
| Capital.com | [Sí](https://open-api.capital.com/) | [Sí](https://github.com/capital-com-sv/capital-mcp), con vista previa y confirmación | Probable; sin confirmar para API y MCP | Sí, con CFDs | Sí, por defecto |
| Kraken Pro | [Sí](https://docs.kraken.com/home/cli) | [Sí](https://docs.kraken.com/home/mcp) | Sí | Sí, perpetuos hasta 10× tras un test de idoneidad | Sí |
| eToro | [Sí](https://api-portal.etoro.com/) | Dudoso | Probable | Sí, con CFDs | Sí |
| Interactive Brokers | [Sí](https://www.interactivebrokers.com/en/trading/ib-api.php) | [Solo redacta](https://www.interactivebrokers.com/en/general/about/mediaRelations/7-28-26.php); la orden la confirma el cliente | Sí | Sí, con cuenta de margen | Sí (sin verificar) |
| Alpaca | [Sí](https://docs.alpaca.markets/us/docs/trading-api-mcp) | [Sí](https://github.com/alpacahq/alpaca-mcp-server) | Dudoso | Acciones de EE. UU. con margen | Sí |
| Trading 212 | [Sí, en beta](https://docs.trading212.com/) | No | Sí | No: la API no cubre CFDs | Sí |
| Revolut X | [Sí](https://developer.revolut.com/docs/api/revolut-x-crypto-exchange) | [Solo lectura](https://github.com/revolut-engineering/revolut-x-api) | Sí | No, solo cripto al contado | No encontrada |
| Coinbase | Sí | [Sí](https://docs.cdp.coinbase.com/ai-agents/coinbase-for-agents/coinbase-mcp) | Sí | Sin confirmar | No |
| OKX | Sí | [Sí](https://www.okx.com/docs-v5/agent_en/) | Sí | Sin confirmar | Sí (sin verificar) |
| Bybit | Sí | [Sí](https://github.com/bybit-exchange/trading-mcp) | Sí, vía bybit.eu | Margen al contado; perpetuos sin confirmar | Sí (sin verificar) |
| Hyperliquid | Sí | No encontrado | Sin bloqueo, pero sin licencia europea ni protección al inversor | Sí, perpetuos | Sí (sin verificar) |

Sin encaje: **Binance** (fuentes de terceros dicen que cierra las cuentas españolas el 31-dic-2026), **Bitget** (licencia europea solo solicitada), **DEGIRO** y **Trade Republic** (sin API), **Robinhood** y **Public.com** (MCP oficial, pero para EE. UU.).

## Lo que cambia respecto a Neverless

- **Los CFDs tienen tope de apalancamiento en Europa** para minoristas: 5:1 en acciones y 2:1 en cripto (dato conocido, no revalidado hoy). El 5× de Neverless sobre cripto no se replica con un CFD.
- **Los perpetuos de Kraken no son CFDs**: llegan a 10× en cripto, piden un test de idoneidad y se puede perder más de lo invertido.
- **Los costes son otros.** En CFDs pesan el diferencial y la financiación nocturna. En perpetuos, la comisión de entrada y salida y el *funding*. En Neverless el apalancamiento es un préstamo contra la cartera, y sus tipos no están publicados.

## Antes de conectar nada con dinero real

1. Probar primero en demo: Capital.com y Kraken la tienen.
2. Confirmar con el propio bróker que la API y el MCP están habilitados para una cuenta española real.
3. El laboratorio no ha demostrado todavía ninguna ventaja que no pueda ser suerte. Automatizar una regla sin ventaja solo automatiza las comisiones.
4. Conectar el laboratorio a un bróker para operar por cuenta de alguien cambia su naturaleza legal: hoy es un experimento educativo (D-16).

## Sin verificar

Entidad europea de Capital.com y su depósito mínimo en España; margen al contado y tamaños mínimos de Kraken en el EEE; comisiones de eToro, IBKR, OKX, Bybit y Coinbase; disponibilidad de Alpaca para residentes en España; XTB, OANDA, Bitpanda y tastytrade no se revisaron.
