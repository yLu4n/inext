# INEXT — loja de keys digitais

Loja responsiva com identidade visual fornecida, categorias Steam, PlayStation, Xbox e Outros, busca, favoritos locais, carrinho, Pix e painel administrativo em `/admin`.

## Stack

React 19 + TypeScript, Vinext (API compatível com Next.js), Cloudflare Workers, D1/SQLite, migrações Drizzle e validação Zod. As operações sensíveis ficam nas rotas de servidor. O banco armazena catálogo, keys, pedidos e configurações; localStorage só guarda favoritos.

## Estado da entrega

A publicação inicial é privada, para revisão do proprietário. O catálogo vazio exibe exemplos claramente marcados, sem gerar pagamentos. Importar exemplos no painel cria produtos INATIVOS, sem estoque. Cadastre edição, região, descrição, preço e keys reais antes de ativá-los.

O administrador da publicação é a conta proprietária configurada em `ADMIN_EMAILS`. Na hospedagem Sites, o login é gerenciado pela plataforma; em desenvolvimento local o starter simula `seedy@sites.test`. Nenhuma senha padrão é criada. A vitrine exige login para finalizar e consultar pedidos. Para usar outra hospedagem/autenticação, adapte `app/chatgpt-auth.ts` e o controle de acesso; headers de identidade nunca devem ser aceitos diretamente em um servidor público sem o proxy confiável da plataforma.

## Ativar Pix

1. Crie sua conta e aplicação no Mercado Pago e habilite Pix conforme as exigências do provedor.
2. Configure nas variáveis protegidas de runtime da hospedagem: `MP_ACCESS_TOKEN` (secret), `MP_WEBHOOK_SECRET` (secret), `SITE_URL` (origem HTTPS real, sem barra final) e `ADMIN_EMAILS` (emails administrativos separados por vírgula).
3. Configure notificações do tipo `payment` para `https://SEU-DOMINIO/api/webhooks/pix`. A URL precisa estar acessível ao Mercado Pago. A publicação privada do Sites bloqueia chamadas externas; abra a loja ao público antes de testar notificações reais. Nunca remova a assinatura HMAC ou a autorização administrativa.
4. Publique novamente para aplicar as variáveis. Teste criação, consulta, expiração, cancelamento, aprovação e reembolso com as contas/credenciais de teste disponibilizadas pelo provedor. Só habilite vendas reais após homologação.
5. Configure WhatsApp e URL HTTPS do instalador em Administração → Configurações. O Discord fornecido já é o padrão.

O checkout calcula preços no servidor e reserva as keys em um lote transacional. A API cria um pagamento Pix via Payments API do Mercado Pago usando o ID do pedido como chave de idempotência. As assinaturas do webhook são verificadas com HMAC SHA-256; o servidor consulta o pagamento no provedor e compara referência, moeda, método e valor. A consulta em Meus pedidos também reconcilia o status. Não existe botão público para marcar pagamentos como aprovados.

Entrega automática exige a opção global e a opção do produto. Entrega manual só libera keys de pedidos aprovados. As keys são acessíveis somente ao comprador autenticado após a liberação. Reembolso/contestação bloqueia novas consultas às keys; uma key já copiada não pode ser revogada pelo site. Ajustes externos e reembolsos são feitos pelo provedor.

As keys de pedidos pendentes permanecem reservadas até o provedor confirmar cancelamento ou rejeição. O administrador deve usar Pedidos → Consultar provedor para liberar essas reservas. Se a criação do pagamento falhar com resultado desconhecido, repita o checkout com a mesma chave de requisição; a idempotência evita cobrança duplicada. Não libere reservas manualmente enquanto o resultado da cobrança for desconhecido. Esta versão não inclui job periódico de reconciliação, envio de email ou automação de estorno.

## Desenvolvimento

```sh
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wealthy_the_renegades.sql
npm run dev
```

No Windows, se o shim npm falhar, invoque o entrypoint com `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run build` ou `node scripts/run-framework.mjs dev`. Para autorizar somente o administrador local, use um `.dev.vars` ignorado pelo Git com `ADMIN_EMAILS="seedy@sites.test"`. Não use esse endereço como administrador em produção.

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/commerce.test.mjs
```

Os testes usam Node 24/SQLite em memória e cobrem disputa pela última key, reserva de carrinho inteiro, cálculo de preço, rollback de importação duplicada, correspondência de pagamento e assinatura de webhook.

## Organização

- `app/store.tsx`, `app/globals.css`: vitrine e checkout.
- `app/admin/page.tsx`: dashboard, produtos, estoque, pedidos e configurações.
- `app/api/*`: APIs e webhook.
- `lib/server.ts`, `lib/payment.ts`, `lib/inventory.ts`: autenticação, pagamento e reserva.
- `db/schema.ts`, `drizzle/`: banco e migrações versionadas.

## Antes da abertura comercial

Cadastre produtos e estoque reais, confira os direitos de distribuição das keys e as imagens usadas, configure dados comerciais e políticas de atendimento/privacidade, disponibilize o instalador oficial e homologue o Pix. As imagens remotas de jogos são demonstrativas. Os resultados do dashboard usam pagamentos aprovados e excluem reembolsados/contestados, com limite de 5.000 pedidos mais recentes. A página inicial não exibe avaliações ou estatísticas fictícias.

Documentação do provedor: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix e https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
