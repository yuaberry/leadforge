import { describe, expect, it } from "vitest";

import { guessMapping, parseCsv } from "@/server/services/csv";

describe("parseCsv", () => {
  it("parser básico com vírgula", () => {
    const { headers, rows } = parseCsv("nome,email,telefone\nJoão,joao@x.com,11999\n");
    expect(headers).toEqual(["nome", "email", "telefone"]);
    expect(rows).toEqual([["João", "joao@x.com", "11999"]]);
  });

  it("detecta ponto-e-vírgula (padrão Excel BR)", () => {
    const { headers, rows } = parseCsv("nome;email\nMaria;maria@x.com");
    expect(headers).toEqual(["nome", "email"]);
    expect(rows).toEqual([["Maria", "maria@x.com"]]);
  });

  it("trata campos com aspas e vírgula interna", () => {
    const { rows } = parseCsv('nome,cidade\n"Silva, João","São Paulo"');
    expect(rows).toEqual([["Silva, João", "São Paulo"]]);
  });

  it("trata aspas escapadas dentro do campo", () => {
    const { rows } = parseCsv('nome\n"Empresa ""Top"""' + "\n");
    expect(rows).toEqual([['Empresa "Top"']]);
  });

  it("suporta CRLF e BOM UTF-8", () => {
    const { headers, rows } = parseCsv("\uFEFFa,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  it("ignora linhas totalmente vazias", () => {
    const { rows } = parseCsv("a,b\n\n\n1,2\n\n");
    expect(rows).toEqual([["1", "2"]]);
  });

  it("retorna vazio para conteúdo vazio", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   \n  \n")).toEqual({ headers: [], rows: [] });
  });

  it("linha final sem newline é incluída", () => {
    const { rows } = parseCsv("a,b\n1,2");
    expect(rows).toEqual([["1", "2"]]);
  });
});

describe("guessMapping", () => {
  it("mapeia cabeçalhos comuns automaticamente", () => {
    const mapping = guessMapping(["Nome", "E-mail", "Telefone", "Cidade"]);
    expect(mapping.name).toBe(0);
    expect(mapping.email).toBe(1);
    expect(mapping.phone).toBe(2);
    expect(mapping.city).toBe(3);
  });

  it("não mapeia cabeçalhos desconhecidos", () => {
    const mapping = guessMapping(["coluna_x", "outra"]);
    expect(mapping.name).toBeUndefined();
  });
});
