/**
 * Parser CSV minimalista e determinístico — sem dependências.
 *
 * Suporta:
 *  - delimitador `,` ou `;` (auto-detecção pela primeira linha)
 *  - campos com aspas e aspas escapadas ("")
 *  - CRLF e LF
 *  - BOM UTF-8
 *  - linhas totalmente vazias são ignoradas
 *
 * Limites de segurança aplicados no caller (tamanho/linhas).
 */

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

function detectDelimiter(headerLine: string): "," | ";" {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(rawText: string): ParsedCsv {
  const text = rawText.replace(/^\uFEFF/, "");
  if (!text.trim()) {
    return { headers: [], rows: [] };
  }

  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  const pushField = () => {
    currentRow.push(currentField);
    currentField = "";
  };
  const pushRow = () => {
    pushField();
    // ignora linhas completamente vazias
    if (currentRow.some((field) => field.trim().length > 0)) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // CR só conta como quebra se não for CRLF (o \n seguinte cuida)
      if (text[i + 1] !== "\n") pushRow();
    } else {
      currentField += char;
    }
  }

  // última linha sem \n no final
  if (currentField.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...dataRows] = rows;
  return {
    headers: headers.map((h) => h.trim()),
    rows: dataRows,
  };
}

export const IMPORT_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024, // 2 MB
  maxRows: 1000,
  maxColumns: 30,
} as const;

/** Campos aceitos no mapeamento (spec §19). */
export const IMPORT_FIELDS = [
  { key: "name", label: "Nome do contato", required: false },
  { key: "company", label: "Empresa", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "website", label: "Website", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "state", label: "Estado", required: false },
  { key: "country", label: "País", required: false },
  { key: "category", label: "Categoria", required: false },
  { key: "jobTitle", label: "Cargo", required: false },
  { key: "notes", label: "Observações", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Chute inicial de mapeamento por nome do cabeçalho. */
const HEADER_HINTS: Record<ImportFieldKey, string[]> = {
  name: ["nome", "name", "contato", "nome do contato"],
  company: ["empresa", "company", "razao social", "razão social"],
  email: ["email", "e-mail", "email address"],
  phone: ["telefone", "phone", "celular", "whatsapp", "fone"],
  website: ["website", "site", "url", "web"],
  city: ["cidade", "city"],
  state: ["estado", "state", "uf"],
  country: ["pais", "país", "country"],
  category: ["categoria", "segmento", "category", "nicho"],
  jobTitle: ["cargo", "funcao", "função", "title", "papel"],
  notes: ["observacoes", "observações", "notes", "nota", "comentario", "comentário"],
};

export type ImportMapping = Partial<Record<ImportFieldKey, number>>;

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const [fieldKey, hints] of Object.entries(HEADER_HINTS) as [ImportFieldKey, string[]][]) {
    const index = lowerHeaders.findIndex((header) => hints.includes(header));
    if (index >= 0) mapping[fieldKey] = index;
  }

  return mapping;
}
