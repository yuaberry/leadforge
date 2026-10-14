import { describe, expect, it } from "vitest";
import { slugify, slugifyWithSuffix } from "@/lib/slug";

describe("slugify", () => {
  it("normaliza acentos e espaços", () => {
    expect(slugify("Clínica São Paulo")).toBe("clinica-sao-paulo");
  });

  it("remove caracteres especiais", () => {
    expect(slugify("Loja do Zé @ Centro!")).toBe("loja-do-ze-centro");
  });

  it("colapsa múltiplos separadores", () => {
    expect(slugify("  a   --  b  ")).toBe("a-b");
  });

  it("limita o tamanho a 48 caracteres", () => {
    expect(slugify("a".repeat(100)).length).toBe(48);
  });

  it("retorna string vazia para input sem caracteres válidos", () => {
    expect(slugify("!!!***")).toBe("");
  });
});

describe("slugifyWithSuffix", () => {
  it("adiciona sufixo", () => {
    expect(slugifyWithSuffix("Minha Org", "x7f2")).toBe("minha-org-x7f2");
  });

  it("usa fallback quando base é vazia", () => {
    expect(slugifyWithSuffix("***", "x7f2")).toBe("org-x7f2");
  });
});
