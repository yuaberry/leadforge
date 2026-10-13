import { describe, expect, it } from "vitest";
import {
  cleanDigits,
  formatCurrency,
  isValidEmail,
  normalizeEmail,
  normalizePhoneBR,
} from "@/lib/format";

describe("normalizeEmail", () => {
  it("remove espaços e aplica lowercase", () => {
    expect(normalizeEmail("  Contato@Clinica.COM.BR ")).toBe("contato@clinica.com.br");
  });

  it("retorna string vazia para input vazio", () => {
    expect(normalizeEmail(null as unknown as string)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("aceita e-mails válidos", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("a.b+c@sub.domain.co")).toBe(true);
  });

  it("rejeita e-mails inválidos", () => {
    expect(isValidEmail("sem-arroba.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@dominio.com")).toBe(false);
    expect(isValidEmail("user @dominio.com")).toBe(false);
    expect(isValidEmail("user@dominio")).toBe(false);
  });
});

describe("cleanDigits", () => {
  it("extrai apenas dígitos", () => {
    expect(cleanDigits("(11) 9abc8765-4321")).toBe("11987654321");
  });
});

describe("normalizePhoneBR", () => {
  it("normaliza telefone fixo com DDD", () => {
    expect(normalizePhoneBR("(11) 3542-8900")).toBe("551135428900");
  });

  it("normaliza celular com máscara", () => {
    expect(normalizePhoneBR("(11) 98765-4321")).toBe("5511987654321");
  });

  it("adiciona código do país quando ausente", () => {
    expect(normalizePhoneBR("11987654321")).toBe("5511987654321");
  });

  it("mantém formato quando já tem código do país", () => {
    expect(normalizePhoneBR("+55 11 98765 4321")).toBe("5511987654321");
  });

  it("retorna null para números impossíveis", () => {
    expect(normalizePhoneBR("123")).toBeNull();
    expect(normalizePhoneBR("")).toBeNull();
    expect(normalizePhoneBR("55")).toBeNull();
    expect(normalizePhoneBR("12345678901234")).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("formata BRL no padrão pt-BR", () => {
    expect(formatCurrency(1234.5)).toContain("1.234,50");
  });
});
