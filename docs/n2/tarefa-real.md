# N2 · tarefa real: o agente usa o `catalogo` sem eu dizer qual tool chamar

Critério do "sólido": o agente usa o servidor numa tarefa de verdade, escolhendo a tool sozinho.
Cada rodada é uma sessão nova. A tarefa não nomeia nenhuma tool nem fala em "catálogo" ou "canal".

## Rodada 1: com o `catalogo`
```bash
claude --strict-mcp-config --mcp-config mcp.catalogo.json
```
Cole exatamente:
```
Preciso de um teste de aceite para a promoção de frete grátis a partir de R$ 100,00 (10000 centavos). Escolha dois produtos reais da nossa loja, um que fique abaixo desse valor e outro acima, e diga com qual base do pedido a condição deve comparar o valor. Não edite arquivos: responda só com o plano do teste.
```

O que anotar (copie do terminal):
1. Quais tools o agente chamou sozinho (as linhas `catalogo - search_catalog_variants (MCP)(...)` e `catalogo - get_channel_pricing (MCP)`), e com quais argumentos.
2. A base do pedido que ele recomendou.
3. Os SKUs e preços (em centavos) que ele escolheu.

Resultado esperado, para conferir depois com o banco: a base é `order.subTotal` (o canal do seed tem `pricesIncludeTax = false`) e cada SKU escolhido existe com aquele preço. Para conferir sem o agente:
```bash
node tools/revisor-mcp/scripts/smoke-catalogo.mjs   # imprime o canal real e confere o catálogo
```

## Rodada 2 (referência, sem o `catalogo`)
```bash
claude --strict-mcp-config
```
Cole o mesmo texto e anote: de onde ele tirou os preços e qual base recomendou. A comparação mostra o que o servidor acrescentou: dados reais no lugar de valores inventados, e a base do desconto.

## Para colar de volta no chat
As linhas de chamada das tools da rodada 1 e as respostas das duas rodadas (só o plano do teste, sem segredo nenhum). Eu confiro os SKUs e os preços contra o banco e atualizo o relatório.
