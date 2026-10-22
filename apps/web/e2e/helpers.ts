import { expect, type Page } from "@playwright/test";

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

/** Próximo dia útil a partir de amanhã (a grade sugerida atende de segunda a sexta). */
export function nextWeekday(): string {
  const date = new Date();
  do date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function bookNewCustomer(
  page: Page,
  data: {
    date: string;
    name: string;
    phone: string;
    pet: string;
    weight: string;
    service: RegExp;
    time: string;
  },
) {
  await page.goto(`/app/agenda/novo?data=${data.date}`);
  await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do tutor").fill(data.name);
  await dialog.getByLabel("Celular com WhatsApp").fill(data.phone);
  await dialog.getByLabel("Nome do pet").fill(data.pet);
  await dialog.getByLabel("Peso (kg)").fill(data.weight);
  await dialog.getByRole("button", { name: "Cadastrar e continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(data.name)).toBeVisible();
  await page.getByRole("button", { name: data.service }).click();
  await page.getByRole("button", { name: data.time, exact: true }).click();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/agenda\\?data=${data.date}&novo=`));
  await expect(page.getByText("Agendamento criado.")).toBeVisible();
}
