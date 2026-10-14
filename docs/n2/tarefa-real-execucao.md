# Rodada 1 - Com o catálogo

● catalogo - get_channel_pricing (MCP)
{
  "channel": "__default_channel__",
  "currency": "USD",
  "prices_include_tax": false,
  "discount_base": "order.subTotal"
}

● catalogo - search_catalog_variants (MCP)(max_price: 9999, order_by: "price_desc", limit: 5)
{
  "total": 45,
  "returned": 5,
  "variants": [
    {
      "sku": "RS0040",
      "product": "Ultraboost Running Shoe",
      "variant": "Ultraboost Running Shoe Size 40",
      "price": 9999,
      "currency": "USD"
    },
    {
      "sku": "RS0042",
      "product": "Ultraboost Running Shoe",
      "variant": "Ultraboost Running Shoe Size 42",
      "price": 9999,
      "currency": "USD"
    },
    {
      "sku": "RS0044",
      "product": "Ultraboost Running Shoe",
      "variant": "Ultraboost Running Shoe Size 44",
      "price": 9999,
      "currency": "USD"
    },
    {
      "sku": "RS0046",
      "product": "Ultraboost Running Shoe",
      "variant": "Ultraboost Running Shoe Size 46",
      "price": 9999,
      "currency": "USD"
    },
    {
      "sku": "F3578640",
      "product": "Pureboost Running Shoe",
      "variant": "Pureboost Running Shoe Size 40",
      "price": 9995,
      "currency": "USD"
    }
  ]
}

● catalogo - search_catalog_variants (MCP)(min_price: 10000, order_by: "price_asc", limit: 5)
{
  "total": 43,
  "returned": 5,
  "variants": [
    {
      "sku": "404.038.96",
      "product": "Modern Cafe Chair",
      "variant": "Modern Cafe Chair mustard",
      "price": 10000,
      "currency": "USD"
    },
    {
      "sku": "404.038.96",
      "product": "Modern Cafe Chair",
      "variant": "Modern Cafe Chair mint",
      "price": 10000,
      "currency": "USD"
    },
    {
      "sku": "404.038.96",
      "product": "Modern Cafe Chair",
      "variant": "Modern Cafe Chair pearl",
      "price": 10000,
      "currency": "USD"
    },
    {
      "sku": "B0012UUP02",
      "product": "Camera Lens",
      "variant": "Camera Lens",
      "price": 10400,
      "currency": "USD"
    },
    {
      "sku": "304.096.29",
      "product": "Wooden Side Desk",
      "variant": "Wooden Side Desk",
      "price": 12500,
      "currency": "USD"
    }
  ]
}


Plano do teste de aceite: frete grátis a partir de 10000 centavos

Base de comparação

A condição deve comparar com order.subTotal, o subtotal sem imposto.

O get_channel_pricing mostrou que o canal __default_channel__ tem prices_include_tax: false e discount_base: order.subTotal. Isso segue a regra do AGENTS.md: use subTotalWithTax quando ctx.channel.pricesIncludeTax for true e subTotal quando for false.

A condição não deve fixar a base no código. Ela deve ler ctx.channel.pricesIncludeTax e escolher a base. No teste, o ctx falso do canal tem pricesIncludeTax: false.

A moeda do canal é USD e não BRL. Isso não muda nada, porque a condição compara só o inteiro em minor units (10000).

Produtos reais, do catálogo (search_catalog_variants)

┌──────────────────┬─────────────────────────────────┬────────────┬─────────────────┬───────────────────┬────────────────────────────────────┐
│      Papel       │             Produto             │    SKU     │     Preço       │   Pedido de 1     │              Esperado              │
│                  │                                 │            │   (centavos)    │      unidade      │                                    │
├──────────────────┼─────────────────────────────────┼────────────┼─────────────────┼───────────────────┼────────────────────────────────────┤
│ Abaixo           │ Ultraboost Running Shoe,        │ RS0042     │ 9999            │ subTotal = 9999   │ condição não satisfeita, frete     │
│                  │ tamanho 42                      │            │                 │                   │ cobrado                            │
├──────────────────┼─────────────────────────────────┼────────────┼─────────────────┼───────────────────┼────────────────────────────────────┤
│ Acima            │ Camera Lens                     │ B0012UUP02 │ 10400           │ subTotal = 10400  │ condição satisfeita, frete grátis  │
├──────────────────┼─────────────────────────────────┼────────────┼─────────────────┼───────────────────┼────────────────────────────────────┤
│ Limite           │ Modern Cafe Chair, mustard      │ 404.038.96 │ 10000           │ subTotal = 10000  │ satisfeita, porque a regra é >=    │
│ (opcional)       │                                 │            │                 │                   │                                    │
└──────────────────┴─────────────────────────────────┴────────────┴─────────────────┴───────────────────┴────────────────────────────────────┘

- O RS0042 é um caso de borda forte, porque fica 1 centavo abaixo do limite. Ele pega um > no lugar de >= e um arredondamento errado.
- As três variantes do Modern Cafe Chair têm o mesmo SKU, 404.038.96. No teste, identifique-as pelo nome da variante e não só pelo SKU.

Arquivo e estrutura

Crio test/frete-gratis.test.ts (vitest, um arquivo por feature). O ctx e o order são objetos falsos, sem banco.

- A regra pura (subTotal >= minimo) ficaria em src/plugins/frete-gratis/regras.ts, sem importar o Vendure.
- A PromotionCondition ficaria no plugin, com code em snake_case (por exemplo frete_gratis_valor_minimo) e description em pt_BR e en.
- O valor mínimo viria de variável de ambiente, lida em vendure-config.ts e passada por Plugin.init().

Casos de teste

1. Abaixo do limite: order = { subTotal: 9999, subTotalWithTax: 11999 }, ctx.channel.pricesIncludeTax = false, mínimo 10000. Esperado: false.
2. Acima do limite: order = { subTotal: 10400, … }. Esperado: true.
3. Exatamente no limite: order = { subTotal: 10000, … }. Esperado: true.
4. Escolha da base: com subTotal: 9999 e subTotalWithTax: 11999, o resultado é false porque o canal não inclui imposto. Isso prova que a condição não usa subTotalWithTax por engano.
5. Canal com imposto incluído: com pricesIncludeTax = true, subTotal: 9000 e subTotalWithTax: 10400, o resultado é true, o que prova a escolha dinâmica da base.
6. Inteiros: os valores de entrada são inteiros em centavos e nenhum arredondamento é aplicado. Se houver arredondamento, usa-se só um Math.round.

O que o teste não cobre

- A ação de frete grátis em si (zerar o frete) não está neste plano, porque o pedido foi só do teste de aceite da condição.
- Cupom, startsAt/endsAt e limites de uso ficam com a Promotion nativa e não são reimplementados.
- Não alterar o teste para ele passar, conforme as regras do projeto.
- Depois de implementar, rodar npm test e npx tsc --noEmit.

Nenhum arquivo foi editado.

✻ Worked for 22s · done 22:59

## Rodada 2 (referência, sem o catalogo)


Vou levantar os preços reais e a configuração do canal antes de montar o plano.

  Searched for 1 pattern, read 3 files, ran 1 shell command

As tools do catalogo não estão ligadas nesta sessão. Vou fazer as mesmas duas consultas fixas deles, em modo somente leitura, direto no vendure.sqlite.

  Read 1 file, listed 1 directory, ran 3 shell commands

Plano do teste de aceite: frete grátis a partir de 10000 centavos

Não editei nenhum arquivo. Consultei só o vendure.sqlite, em modo somente leitura, com as mesmas consultas das tools do catalogo. Essas tools não estão ligadas nesta sessão.

Base de comparação

A condição deve comparar com order.subTotal, sem imposto.

- O canal __default_channel__ tem pricesIncludeTax = 0. Pela regra do projeto, isso manda usar subTotal. Se fosse true, a base seria subTotalWithTax.
- A minimum_order_amount nativa já resolve isso. Ela compara order.subTotal >= amount quando taxInclusive é false e usa subTotalWithTax quando é true. O >= torna o limite inclusivo: exatamente 10000 dá frete grátis.
- Não se deve reimplementar a condição. O plano é minimum_order_amount com amount = 10000 e taxInclusive = false, mais a action nativa free_shipping. Se o teste exigir código novo, isso é sinal de que a regra está sendo reimplementada.
- A moeda cadastrada no canal é USD, não BRL. Os números em centavos valem do mesmo jeito, mas vale confirmar com o financeiro se "R$ 100,00" corresponde a 10000 aqui.

Produtos reais (preços do catálogo, em centavos)

┌────────────────┬───────────────────────────────────┬────────────┬───────┬────────────────────────────────────┐
│     Papel      │              Produto              │    SKU     │ Preço │         Resultado esperado         │
├────────────────┼───────────────────────────────────┼────────────┼───────┼────────────────────────────────────┤
│ Abaixo         │ Ultraboost Running Shoe Size 42   │ RS0042     │ 9999  │ sem frete grátis (falta 1 centavo) │
├────────────────┼───────────────────────────────────┼────────────┼───────┼────────────────────────────────────┤
│ Acima          │ Wooden Side Desk                  │ 304.096.29 │ 12500 │ frete grátis                       │
├────────────────┼───────────────────────────────────┼────────────┼───────┼────────────────────────────────────┤
│ Limite (extra) │ Modern Cafe Chair (variante mint) │ 404.038.96 │ 10000 │ frete grátis (>=)                  │
└────────────────┴───────────────────────────────────┴────────────┴───────┴────────────────────────────────────┘

O SKU 404.038.96 se repete nas três cores do Modern Cafe Chair, então a variante deve ser identificada pelo nome.

Estrutura do teste

O arquivo seria test/frete-gratis.test.ts, um arquivo por feature, com ctx e order falsos e sem banco. O formato seguiria o de test/cupom.test.ts, chamando minimumOrderAmount.check(ctx, order, args, promo) com args = [{name:'amount', value:'10000'}, {name:'taxInclusive', value:'false'}].

Os valores de subTotal e subTotalWithTax seriam diferentes de propósito. Assim o teste falha se a base errada for usada.

1. Abaixo: subTotal: 9999 e subTotalWithTax: 12000. Espera false. Se a condição usasse subTotalWithTax, daria true, e o teste pegaria esse erro.
2. Acima: subTotal: 12500. Espera true.
3. Limite: subTotal: 10000. Espera true.
4. Base com imposto (contraprova): com taxInclusive: true, subTotal: 9999 e subTotalWithTax: 12000 dão true. Isso mostra que o teste distingue as duas bases.
5. Dois itens: duas unidades de um produto barato somam acima do limite. Por exemplo, 2 × RS0042 dão subTotal = 19998 e espera true. Isso confirma que a base é o subtotal do pedido, não o preço de uma linha.

O que fica de fora

Os testes com objetos falsos não provam que a promoção, uma vez criada no dashboard, zera o frete de um pedido real. Isso exigiria e2e com @vendure/testing, que está fora do escopo do SPEC atual.

Para implementar, falta você confirmar dois pontos:
- se a promoção é só configuração no dashboard ou precisa de código novo (hoje o plano não prevê código novo);
- se o SPEC.md será trocado, já que ele descreve o cupom com teto e não o frete grátis.

✻ Churned for 45s · done 23:04