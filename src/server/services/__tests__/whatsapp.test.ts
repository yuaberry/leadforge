import { describe, expect, it } from "vitest";

import { isOptOutMessage } from "@/server/services/optout";
import { parseWhatsAppWebhook } from "@/server/services/whatsapp-webhook";

describe("isOptOutMessage (gate do opt-out)", () => {
  it("detecta palavras-chave diretas", () => {
    expect(isOptOutMessage("SAIR")).toBe(true);
    expect(isOptOutMessage("parar")).toBe(true);
    expect(isOptOutMessage("Stop!")).toBe(true);
    expect(isOptOutMessage("DESCADASTRAR")).toBe(true);
  });

  it("detecta com bordas educadas", () => {
    expect(isOptOutMessage("quero sair")).toBe(true);
    expect(isOptOutMessage("Por favor, parar")).toBe(true);
    expect(isOptOutMessage("quero sair da lista")).toBe(true);
  });

  it("ignora acentos e variações", () => {
    expect(isOptOutMessage("Descadastrar!!")).toBe(true);
    expect(isOptOutMessage("  Sair  ")).toBe(true);
  });

  it("não dá falso positivo em mensagens normais", () => {
    expect(isOptOutMessage("oi, quero saber mais")).toBe(false);
    expect(isOptOutMessage("quanto custa?")).toBe(false);
    expect(isOptOutMessage("saiu no site de vocês?")).toBe(false);
    expect(isOptOutMessage("")).toBe(false);
  });
});

describe("parseWhatsAppWebhook", () => {
  it("normaliza payload típico de mensagem recebida", () => {
    const parsed = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PNID123" },
                contacts: [{ wa_id: "5511987654321", profile: { name: "Maria Silva" } }],
                messages: [
                  {
                    id: "wamid.ABC",
                    from: "5511987654321",
                    timestamp: 1760000000,
                    type: "text",
                    text: { body: "Oi, quero saber mais" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(parsed.phoneNumberId).toBe("PNID123");
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({
      providerMessageId: "wamid.ABC",
      fromPhone: "5511987654321",
      text: "Oi, quero saber mais",
      contactName: "Maria Silva",
    });
    expect(parsed.statuses).toHaveLength(0);
  });

  it("extrai statuses (delivered/read)", () => {
    const parsed = parseWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PNID123" },
                statuses: [{ id: "wamid.X", status: "delivered" }, { id: "wamid.Y", status: "read" }],
              },
            },
          ],
        },
      ],
    });

    expect(parsed.statuses).toEqual([
      { providerMessageId: "wamid.X", status: "delivered" },
      { providerMessageId: "wamid.Y", status: "read" },
    ]);
  });

  it("tolera payloads vazios/estranhos", () => {
    expect(parseWhatsAppWebhook({})).toEqual({ phoneNumberId: null, messages: [], statuses: [] });
    expect(parseWhatsAppWebhook(null)).toEqual({ phoneNumberId: null, messages: [], statuses: [] });
    expect(parseWhatsAppWebhook({ entry: "nope" })).toEqual({
      phoneNumberId: null,
      messages: [],
      statuses: [],
    });
  });

  it("mensagem de botão também conta como texto", () => {
    const parsed = parseWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.B", from: "5511", type: "button", button: { text: "Quero oferta" } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(parsed.messages[0]?.text).toBe("Quero oferta");
  });
});
