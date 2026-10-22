import type { Page } from "@playwright/test";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@exemplo.com.br`;
}

/** Salva um print na pasta indicada por E2E_SCREENSHOTS (para revisão visual). */
export async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

export async function signUp(
  page: Page,
  data: { shop: string; name: string; email: string; password?: string },
) {
  await page.goto("/criar-conta");
  await page.getByLabel("Nome do pet shop").fill(data.shop);
  await page.getByLabel("Seu nome").fill(data.name);
  await page.getByLabel("Seu celular com WhatsApp").fill("(19) 98765-4321");
  await page.getByLabel("E-mail").fill(data.email);
  await page.getByLabel("Senha").fill(data.password ?? "senha-forte-123");
  await page.getByRole("checkbox", { name: /termos de uso/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
}
