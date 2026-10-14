import { describe, expect, it } from "vitest";

import {
  companyNameAddressHash,
  normalizeCompany,
  normalizeContact,
  normalizeWebsite,
} from "@/server/services/normalization";

describe("normalizeWebsite", () => {
  it("adiciona https:// quando ausente", () => {
    expect(normalizeWebsite("clinica.com.br")).toEqual({
      website: "https://clinica.com.br",
      domain: "clinica.com.br",
    });
  });

  it("remove www do domínio", () => {
    expect(normalizeWebsite("www.loja.com").domain).toBe("loja.com");
  });

  it("rejeita valores inválidos sem inventar", () => {
    expect(normalizeWebsite("não é site")).toEqual({ website: null, domain: null });
    expect(normalizeWebsite("")).toEqual({ website: null, domain: null });
  });
});

describe("companyNameAddressHash", () => {
  it("é determinístico e case-insensitive", () => {
    const a = companyNameAddressHash("Clínica Vale", "São Paulo", "SP");
    const b = companyNameAddressHash("clínica vale", "são paulo", "sp");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retorna null sem nome", () => {
    expect(companyNameAddressHash(null, "SP", "SP")).toBeNull();
  });
});

describe("normalizeCompany", () => {
  it("normaliza todos os campos de uma vez", () => {
    const result = normalizeCompany({
      name: "  Clínica Odonto Vida  ",
      website: "clinicaodonto.com.br",
      phone: "(11) 98765-4321",
      email: "  Contato@Clinica.COM.BR ",
      city: "São Paulo",
      state: "SP",
      category: " Saúde ",
    });

    expect(result.name).toBe("Clínica Odonto Vida");
    expect(result.domain).toBe("clinicaodonto.com.br");
    expect(result.phoneNormalized).toBe("5511987654321");
    expect(result.emailNormalized).toBe("contato@clinica.com.br");
    expect(result.category).toBe("Saúde");
    expect(result.nameAddressHash).toBeTruthy();
  });

  it("descarta e-mail inválido sem inventar", () => {
    const result = normalizeCompany({ name: "X", email: "sem-arroba" });
    expect(result.emailNormalized).toBeNull();
  });

  it("telefone impossível não gera chave de dedup", () => {
    const result = normalizeCompany({ name: "X", phone: "123" });
    expect(result.phoneNormalized).toBeNull();
  });
});

describe("normalizeContact", () => {
  it("normaliza nome, e-mail e telefone", () => {
    const result = normalizeContact({
      fullName: "  Maria Silva ",
      email: "MARIA@Exemplo.com ",
      phone: "11987654321",
    });
    expect(result.fullName).toBe("Maria Silva");
    expect(result.emailNormalized).toBe("maria@exemplo.com");
    expect(result.phoneNormalized).toBe("5511987654321");
  });
});
