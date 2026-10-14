/**
 * Renderização de templates de campanha (função pura).
 *
 * Placeholders: {{nome}}, {{nome_completo}}, {{empresa}}, {{cidade}},
 * {{link}} (link rastreado do produto), {{unsubscribe_link}}.
 * Placeholders desconhecidos viram string vazia — nunca quebram o envio.
 */

export type TemplateVars = Record<string, string | null | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = vars[key.toLowerCase()];
    return value ?? "";
  });
}

export const TEMPLATE_HELP = [
  { key: "{{nome}}", label: "Primeiro nome do contato" },
  { key: "{{nome_completo}}", label: "Nome completo" },
  { key: "{{empresa}}", label: "Nome da empresa" },
  { key: "{{cidade}}", label: "Cidade da empresa" },
  { key: "{{link}}", label: "Link rastreado do produto (gerado por lead)" },
  { key: "{{unsubscribe_link}}", label: "Link de cancelamento" },
] as const;

/** Rodapé de conformidade obrigatório em todo e-mail de campanha. */
export function appendEmailFooter(body: string, unsubLink: string): string {
  const footer = `\n\n—\nNão quer mais receber estes e-mails? Cancele aqui: ${unsubLink}`;
  return `${body.trimEnd()}${footer}`;
}
