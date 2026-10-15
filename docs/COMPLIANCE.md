# LEADFORGE — Compliance (LGPD)

## Princípio geral

O LeadForge é construído para **prospecção comercial responsável**: massa vem do
funil (captura consentida + fontes oficiais + relevância), nunca de spam. Isso
protege o usuário e a operação — contas Kiwify/Kirvano/WhatsApp/provedores
proíbem disparos indiscriminados, e o LeadForge enforça isso no código.

## Dados pessoais — onde entram

| Origem | Base legal | Registro |
|---|---|---|
| Página de captura `/p/[slug]` | **Consentimento** (checkbox com texto claro) | `form_submissions` com data/hora, IP, UTM |
| Import CSV | **Proveniência obrigatória** + base legal declarada (consentimento, legítimo interesse ou contrato) — sem isso o import não roda | `import_batches` + `lead_sources` + campo `legal_basis` em cada lead |
| Discovery (Google Places) | **Legítimo interesse** — listagem pública de empresa via API oficial | `source=discovery`, campos ToS-compliant |
| WhatsApp inbound | **Consentimento** (o contato iniciou a conversa) | conversa registrada em `conversations` |

## Direitos do titular

- **Acesso / portabilidade**: `GET /api/export/leads?format=csv|json` exporta
  todos os leads da organização (com consentimento, proveniência e histórico).
- **Eliminação**: excluir lead remove cascata (mensagens, campanhas, conversas,
  rascunhos) + contatos órfãos + timeline (direito ao esquecimento).
- **Oposição (opt-out)**: 3 caminhos, todos auditados —
  1. Link de unsubscribe em **todo** e-mail (HMAC, 1 clique, sem login);
  2. Palavra-chave no WhatsApp (SAIR/PARAR/STOP...);
  3. Pedido manual (suppression na UI).
  Efeito: `suppression_list` (canal `all`) + `opted_out_at` — **nenhum** disparo
  futuro, teste automático no CI.
- Reativação é ação consciente do administrador, registrada na auditoria.

## Invariáveis enforçadas (e testadas)

1. `decideEligibility()` é a ÚNICA porta de envio: suppression + opt-out +
   canal + base legal — vale para campanhas, follow-up e **resposta manual**.
2. Bounce/complaint de e-mail → suppression automática.
3. Campanhas `manual` nunca enviam sem aprovação humana.
4. Caps diários + janela horária + limite mensal do plano.
5. Nenhum dado é presumido como consentido: `consent_status` default é `unknown`
   e envio exige base legal declarada.

## Proibições de produto (§44 do plano)

Sem scraping do Google Maps · sem bypass de CAPTCHA/rate limit/banimento ·
sem WhatsApp Web automatizado · sem listas ilegais · sem envio sem opt-out ·
sem coleta secreta.

## Retenção

- `retention_until` disponível no schema para políticas por lead (o padrão
  atual é "enquanto a org mantiver o relacionamento").
- Eliminação sob demanda via UI — e recomenda-se revisar a suppression list
  periodicamente (contatos sem interação podem ser eliminados por LGPD).

## Sites de terceiros

Google Maps Platform (Places API New — armazenamento dos campos permitidos,
refresh via `place_id`), WhatsApp Business Platform (Cloud API, janela 24h,
opt-out), Resend (envio transacional), OpenRouter (análise — apenas dados do
lead necessários ao prompt, sem secrets).
