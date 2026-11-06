/**
 * LEADFORGE — E2E (navegador real): cadastro → onboarding → produto → lead →
 * campanha (manual e automatizada) → disparo de e-mail.
 *
 * O script dirige o app de verdade (Chrome via Playwright), coleta erros de
 * console/página e confere o resultado no Postgres. Nada é mockado no app:
 * o único mock é o servidor local de Auth (scripts/mock-supabase-auth.ts) e o
 * provedor de e-mail (sem RESEND_API_KEY o envio é simulado e marcado como
 * `mock` — nunca sai e-mail real).
 *
 * Uso:
 *   export DATABASE_URL=postgresql://...
 *   bun run scripts/e2e-dispatch.ts
 *
 * Flags:
 *   E2E_BASE_URL   (default http://localhost:4210)
 *   E2E_KEEP=1     mantém os dados no banco (default: mantém para inspeção)
 *   E2E_HEADFUL=1  abre o navegador visível
 */
import { chromium, type Browser, type ConsoleMessage, type Page } from "playwright";
import postgres from "postgres";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4210";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatório para o E2E (verificação no banco).");
}

const sql = postgres(DATABASE_URL, { max: 3 });

const stamp = Date.now();
const USER_EMAIL = `e2e-${stamp}@leadforge.local`;
const USER_PASSWORD = "Senha-Forte-123";
const ORG_NAME = `Operação E2E ${stamp}`;
const PRODUCT_NAME = `Método Venda Digital E2E ${stamp}`;
const LEAD_NAME = "Ana Paula E2E";
const LEAD_EMAIL = `lead-${stamp}@empresa-teste.local`;

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  const marca = ok ? "✔" : "✘";
  process.stdout.write(`  ${marca} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

function check(name: string, cond: boolean, detail?: string): void {
  record(name, cond, detail);
  if (!cond) throw new Error(`Falhou: ${name}${detail ? ` — ${detail}` : ""}`);
}

function onConsole(msg: ConsoleMessage): void {
  if (msg.type() !== "error") return;
  const text = msg.text();
  // Ruído conhecido do ambiente de teste (favicon / HMR / source maps).
  if (/favicon|DevTools|Download the React DevTools/i.test(text)) return;
  consoleErrors.push(`[console] ${text}`);
}

function onPageError(err: Error): void {
  pageErrors.push(`[pageerror] ${err.message}`);
}

/** Espera um seletor aparecer (com mensagem clara em caso de timeout). */
async function waitFor(page: Page, selector: string, timeout = 20_000): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout, state: "visible" });
  } catch {
    throw new Error(`Timeout esperando seletor: ${selector} (url=${page.url()})`);
  }
}

/** Clica em um botão pelo texto (evita depender de classes do shadcn). */
async function clickText(page: Page, text: string, exact = false): Promise<void> {
  const locator = page.getByRole("button", { name: text, exact }).or(
    page.getByRole("link", { name: text, exact })
  );
  await locator.first().click({ timeout: 20_000 });
}

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch({
    channel: "chrome",
    headless: process.env.E2E_HEADFUL !== "1",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 1. Cadastro\n");
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });
    await waitFor(page, 'form input#name');
    await page.fill('form input#name', "Testador E2E");
    await page.fill('form input#email', USER_EMAIL);
    await page.fill('form input#password', USER_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 }),
      clickText(page, "Criar conta"),
    ]);
    check("signup cria conta e redireciona", /onboarding|dashboard/.test(page.url()), page.url());

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 2. Onboarding (5 etapas)\n");
    if (page.url().endsWith("/dashboard")) {
      await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
    }

    // Etapa 1 — criar organização (exercita o fix de RLS no INSERT ... RETURNING)
    await waitFor(page, 'input#name[name="name"]');
    await page.fill('input#name[name="name"]', ORG_NAME);
    await clickText(page, "Criar organização");
    await waitFor(page, 'input[name="businessMode"]', 30_000);
    check("etapa 1: organização criada sob RLS", true);

    // Etapa 2 — modelo de negócio + categoria
    // Os inputs são `sr-only` (visualmente escondidos dentro de um <label>),
    // então clicamos no rótulo — exatamente como um usuário faria.
    await page.locator('label:has(input[name="businessMode"][value="affiliate"])').click();
    await page.locator('label:has(input[name="categories"])').first().click();
    await clickText(page, "Continuar");
    await waitFor(page, 'input[name="email"]', 30_000);
    check("etapa 2: modelo de negócio salvo", true);

    // Etapa 3 — canal e-mail
    await page.locator('label:has(input[name="email"])').click();
    await clickText(page, "Continuar");
    await waitFor(page, "#dreamName", 30_000);
    check("etapa 3: canal e-mail habilitado", true);

    // Etapa 4 — meta dos sonhos
    await page.fill("#dreamName", "Notebook gamer");
    await page.fill("#dreamAmount", "8500");
    await clickText(page, "Salvar minha meta");
    await waitFor(page, 'button:has-text("Concluir e abrir o dashboard")', 30_000);
    check("etapa 4: meta dos sonhos salva", true);

    // Etapa 5 — concluir
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
      clickText(page, "Concluir e abrir o dashboard"),
    ]);
    check("etapa 5: onboarding concluído", page.url().includes("/dashboard"), page.url());

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 3. Produto\n");
    await page.goto(`${BASE_URL}/products/new`, { waitUntil: "domcontentloaded" });
    await waitFor(page, 'input#name[name="name"]');
    await page.fill('input#name[name="name"]', PRODUCT_NAME);
    await page.selectOption("#type", "affiliate");
    await page.selectOption("#platform", "kiwify");
    await page.fill("#checkoutUrl", "https://pay.kiwify.com.br/e2e-checkout");
    await page.fill("#price", "197");
    await page.fill("#commissionPercent", "50");
    await clickText(page, "Criar produto");
    await page.waitForURL(/\/products\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const [product] = await sql`
      SELECT id, name, type, platform, status FROM public.products
      WHERE name = ${PRODUCT_NAME} AND organization_id = (
        SELECT organization_id FROM public.organization_members m
        JOIN public.users u ON u.id = m.user_id
        WHERE u.email = ${USER_EMAIL} LIMIT 1
      )
    `;
    check("produto persistido no banco", Boolean(product), product ? product.name : "não encontrado");

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 4. Lead\n");
    await page.goto(`${BASE_URL}/leads/new`, { waitUntil: "domcontentloaded" });
    await waitFor(page, "#contactName");
    await page.fill("#contactName", LEAD_NAME);
    await page.fill("#companyName", `Empresa E2E ${stamp}`);
    await page.fill("#email", LEAD_EMAIL);
    await page.fill("#phone", "11987654321");
    await page.fill("#city", "São Paulo");
    await page.fill("#state", "SP");
    await clickText(page, "Criar lead");
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const [lead] = await sql`
      SELECT l.id, c.email_normalized, l.legal_basis, l.consent_status
      FROM public.leads l
      JOIN public.contacts c ON c.id = l.contact_id
      WHERE c.email_normalized = ${LEAD_EMAIL}
    `;
    check("lead persistido com base legal", Boolean(lead), lead ? lead.legal_basis : "não encontrado");

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 5. Campanha MANUAL (aprovação humana)\n");
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "domcontentloaded" });
    await waitFor(page, "#camp-name");
    await page.fill("#camp-name", `Campanha Manual E2E ${stamp}`);
    await page.selectOption("#camp-mode", "manual");
    if (product) await page.selectOption("#camp-product", product.id);
    await page.fill("#camp-cap", "10");
    await page.fill("#camp-hstart", "0");
    await page.fill("#camp-hend", "24");
    await clickText(page, "Criar campanha");
    await page.waitForSelector("text=/Campanha criada/", { timeout: 30_000 });
    const [manualCampaign] = await sql`
      SELECT c.id, c.mode, c.status FROM public.campaigns c
      WHERE c.name = ${`Campanha Manual E2E ${stamp}`}
    `;
    check("campanha manual criada", Boolean(manualCampaign), manualCampaign?.mode);

    if (!manualCampaign) throw new Error("campanha manual não encontrada");

    // -- abrir campanha e configurar etapa/leads/ativação --
    await page.goto(`${BASE_URL}/campaigns/${manualCampaign.id}`, { waitUntil: "domcontentloaded" });
    await waitFor(page, 'textarea[id^="body-"]');
    await page.fill('input[id^="subject-"]', "Sua clínica pode vender mais pelo digital");
    await page.fill(
      'textarea[id^="body-"]',
      "Oi {{nome}}, vi a {{empresa}} e pensei num método para converter mais interestedos em vendas. Posso te mostrar em 2 minutos?"
    );
    await clickText(page, "Adicionar etapa 1");
    await page.waitForSelector("text=/Etapa adicionada/", { timeout: 30_000 });
    check("etapa 1 criada", true);

    await clickText(page, "Adicionar leads");
    await page.waitForSelector("text=/lead.*adicionado|Nenhum lead novo/", { timeout: 30_000 });
    const [campaignLead] = await sql`
      SELECT id FROM public.campaign_leads WHERE campaign_id = ${manualCampaign.id}
    `;
    check("lead vinculado à campanha", Boolean(campaignLead));

    await clickText(page, "Ativar campanha");
    await page.waitForSelector("text=/Campanha ativa/", { timeout: 30_000 });
    const [activated] = await sql`SELECT status FROM public.campaigns WHERE id = ${manualCampaign.id}`;
    check("campanha ativada", activated?.status === "active", activated?.status);

    // -- processar leva: modo manual NÃO envia sozinho --
    await clickText(page, "Processar leva agora");
    await page.waitForSelector("text=/aguardando aprovação/", { timeout: 40_000 });
    const manualMessages = await sql`
      SELECT id, status, to_address, subject, body FROM public.messages
      WHERE campaign_id = ${manualCampaign.id} ORDER BY created_at
    `;
    check(
      "modo manual gera pendente de aprovação (não envia)",
      manualMessages.length === 1 && manualMessages[0].status === "pending_approval",
      `status=${manualMessages[0]?.status}`
    );
    check(
      "mensagem contém o rodapé de descadastro",
      typeof manualMessages[0]?.body === "string" &&
        /descadastrar|cancelar|cancele|sair/i.test(manualMessages[0].body),
      manualMessages[0]?.body?.slice(-120)
    );

    // -- aprovar e enviar --
    await clickText(page, "Aprovar e enviar");
    // O Next.js revalida o caminho na action, mas a página cliente só reflete
    // a mudança após recarregar. Aguardamos e recarregamos para ler o estado atual.
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const uiText = await page.locator("body").innerText();
    const pendenteAposAprovacao = /Aprovação pendente \(0\)/.test(uiText);
    // Fonte da verdade: o banco deve mostrar a mensagem como enviada.
    const [sentManual] = await sql`
      SELECT status, sent_at, provider FROM public.messages WHERE id = ${manualMessages[0].id}
    `;
    check(
      "aprovação envia a mensagem",
      sentManual?.status === "sent" || sentManual?.status === "delivered",
      `status=${sentManual?.status} provider=${sentManual?.provider} ui_pendente0=${pendenteAposAprovacao}`
    );

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 6. Campanha AUTOMATIZADA\n");
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "domcontentloaded" });
    await waitFor(page, "#camp-name");
    await page.fill("#camp-name", `Campanha Auto E2E ${stamp}`);
    await page.selectOption("#camp-mode", "automated");
    if (product) await page.selectOption("#camp-product", product.id);
    await page.fill("#camp-cap", "10");
    await page.fill("#camp-hstart", "0");
    await page.fill("#camp-hend", "24");
    await clickText(page, "Criar campanha");
    await page.waitForSelector("text=/Campanha criada/", { timeout: 30_000 });
    const [autoCampaign] = await sql`
      SELECT id, mode FROM public.campaigns WHERE name = ${`Campanha Auto E2E ${stamp}`}
    `;
    check("campanha automatizada criada", Boolean(autoCampaign), autoCampaign?.mode);

    if (!autoCampaign) throw new Error("campanha automatizada não encontrada");

    await page.goto(`${BASE_URL}/campaigns/${autoCampaign.id}`, { waitUntil: "domcontentloaded" });
    await waitFor(page, 'textarea[id^="body-"]');
    await page.fill('input[id^="subject-"]', "Follow-up: 3 passos para vender mais");
    await page.fill('textarea[id^="body-"]', "{{nome}}, te mando o passo 2 do método em 2 dias.");
    await clickText(page, "Adicionar etapa 1");
    await page.waitForSelector("text=/Etapa adicionada/", { timeout: 30_000 });
    await clickText(page, "Adicionar leads");
    await page.waitForSelector("text=/lead.*adicionado|Nenhum lead novo/", { timeout: 30_000 });
    await clickText(page, "Ativar campanha");
    await page.waitForSelector("text=/Campanha ativa/", { timeout: 30_000 });
    await clickText(page, "Processar leva agora");
    await page.waitForSelector("text=/Processados:/", { timeout: 40_000 });

    const autoMessages = await sql`
      SELECT id, status, to_address, provider FROM public.messages
      WHERE campaign_id = ${autoCampaign.id} ORDER BY created_at
    `;
    check(
      "modo automatizado envia sozinho (após todos os gates)",
      autoMessages.length === 1 &&
        (autoMessages[0].status === "sent" || autoMessages[0].status === "delivered"),
      `status=${autoMessages[0]?.status} total=${autoMessages.length}`
    );
    check(
      "envio marcado como mock (sem RESEND_API_KEY)",
      autoMessages[0]?.provider === "mock",
      `provider=${autoMessages[0]?.provider}`
    );

    // ------------------------------------------------------------------
    process.stdout.write("\n▶ 7. Gate de supressão (opt-out bloqueia o disparo)\n");
    await sql`
      INSERT INTO public.suppression_list (organization_id, email_normalized, reason)
      SELECT o.id, ${LEAD_EMAIL}, 'manual'
      FROM public.organizations o
      JOIN public.organization_members m ON m.organization_id = o.id
      JOIN public.users u ON u.id = m.user_id
      WHERE u.email = ${USER_EMAIL}
    `;

    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "domcontentloaded" });
    await waitFor(page, "#camp-name");
    await page.fill("#camp-name", `Campanha Suprimido E2E ${stamp}`);
    await page.selectOption("#camp-mode", "automated");
    await page.fill("#camp-cap", "10");
    await page.fill("#camp-hstart", "0");
    await page.fill("#camp-hend", "24");
    await clickText(page, "Criar campanha");
    await page.waitForSelector("text=/Campanha criada/", { timeout: 30_000 });
    const [suppressedCampaign] = await sql`
      SELECT id FROM public.campaigns WHERE name = ${`Campanha Suprimido E2E ${stamp}`}
    `;
    if (!suppressedCampaign) throw new Error("campanha de supressão não encontrada");

    await page.goto(`${BASE_URL}/campaigns/${suppressedCampaign.id}`, {
      waitUntil: "domcontentloaded",
    });
    await waitFor(page, 'textarea[id^="body-"]');
    await page.fill('input[id^="subject-"]', "Teste de supressão");
    await page.fill('textarea[id^="body-"]', "Mensagem que NÃO deve ser enviada ao contato suprimido.");
    await clickText(page, "Adicionar etapa 1");
    await page.waitForSelector("text=/Etapa adicionada/", { timeout: 30_000 });
    await clickText(page, "Adicionar leads");
    await page.waitForSelector("text=/lead.*adicionado|Nenhum lead novo/", { timeout: 30_000 });
    await clickText(page, "Ativar campanha");
    await page.waitForSelector("text=/Campanha ativa/", { timeout: 30_000 });
    await clickText(page, "Processar leva agora");
    await page.waitForSelector("text=/Processados:/", { timeout: 40_000 });

    const suppressedMessages = await sql`
      SELECT id, status FROM public.messages WHERE campaign_id = ${suppressedCampaign.id}
    `;
    check(
      "contato suprimido NUNCA recebe (0 mensagens)",
      suppressedMessages.length === 0,
      `mensagens=${suppressedMessages.length}`
    );
  } finally {
    // ------------------------------------------------------------------
    process.stdout.write("\n▶ Resumo\n");
    const failures = results.filter((r) => !r.ok);
    process.stdout.write(`  ${results.length - failures.length}/${results.length} verificações OK\n`);

    if (consoleErrors.length > 0) {
      process.stdout.write("\n  Erros de console:\n");
      for (const erro of consoleErrors) process.stdout.write(`    ${erro}\n`);
    } else {
      process.stdout.write("  Nenhum erro de console.\n");
    }

    if (pageErrors.length > 0) {
      process.stdout.write("\n  Erros de página:\n");
      for (const erro of pageErrors) process.stdout.write(`    ${erro}\n`);
    } else {
      process.stdout.write("  Nenhum erro de página.\n");
    }

    process.stdout.write(
      `\n  Usuário de teste: ${USER_EMAIL}\n  Organização: ${ORG_NAME}\n`
    );

    await context.close();
    await browser.close();
    await sql.end();

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  }
}

main().catch((erro) => {
  console.error("\n✘ E2E falhou:", erro);
  process.exitCode = 1;
});
