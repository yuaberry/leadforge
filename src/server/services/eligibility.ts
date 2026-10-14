/**
 * LEADFORGE — Gate de elegibilidade (INVARIÁVEL do sistema).
 *
 * TODO path de envio (manual, campanha, follow-up, bulk) passa por aqui.
 * "Contato suprimido nunca recebe mensagem" — testado nesta função pura.
 */

export type EligibilityInput = {
  email: string | null;
  phone: string | null;
  /** Linhas de suppression da org relevantes (email/phone). */
  suppression: { emailNormalized: string | null; phoneNormalized: string | null; channel: string }[];
  optedOutAt: string | null;
  consentStatus: string;
  legalBasis: string | null;
  /** Canal do envio pretendido. */
  channel: "email" | "whatsapp";
};

export type EligibilityDecision =
  | { eligible: true }
  | { eligible: false; reason: "suppressed" | "opted_out" | "no_contact" | "no_legal_basis" };

export function decideEligibility(input: EligibilityInput): EligibilityDecision {
  if (input.optedOutAt) {
    return { eligible: false, reason: "opted_out" };
  }

  const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
  const emailSuppressed =
    normalizedEmail !== null &&
    input.suppression.some(
      (row) =>
        row.emailNormalized === normalizedEmail &&
        (row.channel === "all" || row.channel === input.channel)
    );

  const normalizedPhone = input.phone ?? null;
  const phoneSuppressed =
    normalizedPhone !== null &&
    input.suppression.some(
      (row) =>
        row.phoneNormalized === normalizedPhone &&
        (row.channel === "all" || row.channel === input.channel)
    );

  if (emailSuppressed || phoneSuppressed) {
    return { eligible: false, reason: "suppressed" };
  }

  // Canal e-mail exige endereço
  if (input.channel === "email" && !normalizedEmail) {
    return { eligible: false, reason: "no_contact" };
  }

  // Base legal: consentimento explícito OU base declarada (legítimo interesse/contrato)
  const hasLegalBasis =
    input.consentStatus === "granted" ||
    input.legalBasis === "consent" ||
    input.legalBasis === "legitimate_interest" ||
    input.legalBasis === "contract";

  if (input.consentStatus === "refused" || !hasLegalBasis) {
    return { eligible: false, reason: "no_legal_basis" };
  }

  return { eligible: true };
}

export const ELIGIBILITY_REASON_LABELS: Record<string, string> = {
  suppressed: "Na suppression list",
  opted_out: "Solicitou cancelamento (opt-out)",
  no_contact: "Sem e-mail válido para este canal",
  no_legal_basis: "Sem base legal para contato",
};
