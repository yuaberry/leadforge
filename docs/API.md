# LEADFORGE — API

Rotas internas e webhooks. Todas autenticadas por cookie de sessão (Supabase)
ou token de webhook; responses JSON exceto downloads.

## Webhooks (públicos, autenticados por token)

### `POST /api/webhooks/commerce/[platform]?token=<webhook_token>`
Vendas da Kiwify/Kirvano (`platform` ∈ `kiwify|kirvano`).
- Auth: `commerce_integrations.webhook_token` + `phone/platform` casamento.
- Idempotente por `(org, platform, external_order_id)`; reentrega atualiza status
  (paid→refunded remove a receita automática).
- Efeitos: `sales` → reconcilia `financial_transactions` → aloca % na meta ativa.
- Respostas: `200 {received:true}` · `400` payload inválido · `401` token · `404` plataforma.

### `GET/POST /api/webhooks/email/resend?token=<webhook_token>`
- `GET`: nada (config no painel) · eventos via `POST`.
- `email.bounced|email.complained` → suppression automática + status da mensagem.
- `email.delivered` → status delivered.

### `GET /api/webhooks/whatsapp?token=<webhook_token>`
- `GET` com `hub.mode=subscribe&hub.verify_token=<WHATSAAP_VERIFY_TOKEN>` → echo
  `hub.challenge` (verificação da Meta).
- `POST`: mensagens (cria conversa/lead; consentimento = contato iniciou) e
  statuses (`sent/delivered/read/failed`).
- Palavras-chave de opt-out (SAIR/PARAR/STOP...) → suppression `all` + `opted_out_at`
  + confirmação automática.
- Idempotente por `provider_message_id`.

## Cron

### `GET/POST /api/cron/process-campaigns`
- Auth: `Authorization: Bearer <CRON_SECRET>`.
- Percorre campanhas `active` de todas as orgs (serviceDb documentado) e processa
  uma leva (respeitando caps, janela horária, gate de elegibilidade e modo manual).

## Export (autenticado por sessão)

### `GET /api/export/leads?format=csv|json`
Download dos leads da org ativa (direito de acesso LGPD) com resumo financeiro no JSON.

## Server Actions (uso interno)

Todas em `src/app/**/actions.ts` — validadas com Zod, escopadas pela org do
contexto (`requireOrgContext`) e protegidas pela RLS. Destaques de contrato:

| Action | Efeito |
|---|---|
| `upsertLead` (via actions de leads/import/captura/discovery) | normaliza → dedup → cria lead + score |
| `analyzeLeadAction` | IA com limite do plano; rescore com sinal `ai_need` |
| `generateMessageAction` | rascunho com link rastreado por lead |
| `approveMessageAction` | **revalida** o gate antes do envio manual |
| `moveDealAction` | kanban (drag&drop → action) |
| `sendInboxReplyAction` | resposta manual sob gate de elegibilidade |
| `assertWithinPlanLimit` | limites de plano em leads/mensagens/IA/campanhas/usuarios |

## Convenções de erro

- Actions retornam `{ error }` com mensagem pt-BR pronta para exibir.
- RLS produz mensagem "Bloqueado pela política de segurança" — nunca detalhe interno.
- Rate limit: `429` com `Retry-After` implícito (mensagem orientando aguardar).
