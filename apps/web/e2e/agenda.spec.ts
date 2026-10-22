import { expect, test, type Page } from "@playwright/test";
import { signUp, snap, uniqueEmail } from "./helpers";

/** Próximo dia útil a partir de amanhã (a grade sugerida atende de segunda a sexta). */
function nextWeekday(): string {
  const date = new Date();
  do date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function bookNewCustomer(
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

test("agenda: agendar, respeitar as vagas, operar a fila e cancelar", async ({ page }) => {
  test.setTimeout(240_000);
  await signUp(page, { shop: "Pet Shop Agenda", name: "Rita Alves", email: uniqueEmail("agenda") });
  await page.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await page.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/dados$/);

  // Grade sugerida (2 vagas por hora) e serviços sugeridos.
  await page.goto("/app/configurar/horarios");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/servicos$/);
  await page.getByRole("button", { name: "Adicionar serviços marcados" }).click();
  await expect(page.getByText("Banho e tosa na tesoura")).toBeVisible();

  const date = nextWeekday();

  // 1. Thor (porte P): banho de 1h às 09:00.
  await bookNewCustomer(page, {
    date,
    name: "Carla Mendes",
    phone: "(19) 99111-2233",
    pet: "Thor",
    weight: "8",
    service: /^Banho R\$/,
    time: "09:00",
  });

  // 2. Mel (porte P): tosa na tesoura de 2h às 08:00, ocupa 08:00 e 09:00.
  await bookNewCustomer(page, {
    date,
    name: "Diego Rocha",
    phone: "(19) 99222-3344",
    pet: "Mel",
    weight: "6",
    service: /^Banho e tosa na tesoura R\$/,
    time: "08:00",
  });
  await expect(page.getByRole("link", { name: /^Mel/ }).first()).toBeVisible();
  await expect(page.getByText("continua")).toBeVisible();
  await snap(page, "20-agenda-dia");

  // 3. Às 09:00 as duas vagas estão ocupadas: o horário não aparece para um terceiro pet.
  await page.goto(`/app/clientes`);
  await page.getByRole("link", { name: /Carla Mendes/ }).click();
  await page.getByRole("link", { name: "Agendar" }).click();
  await page.getByRole("button", { name: /^Banho R\$/ }).click();
  await page.getByLabel("Dia").fill(date);
  await expect(page.getByRole("button", { name: "10:00", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "08:00", exact: true })).toBeVisible();
  // Encaixe (dono): mostra também os horários cheios.
  await page.getByText("Encaixe acima das vagas").click();
  await expect(page.getByRole("switch", { name: "Encaixe acima das vagas" })).toBeChecked();
  await expect(page.getByRole("button", { name: "09:00", exact: true })).toBeVisible();
  await snap(page, "21-novo-agendamento");

  // 4. Operar a fila: Thor chegou.
  await page.goto(`/app/agenda?data=${date}`);
  const thor = page
    .getByRole("listitem")
    .filter({ hasText: "Thor" })
    .filter({ hasText: "Carla Mendes" });
  await thor.getByRole("button", { name: "Registrar chegada" }).click();
  await expect(page.getByText("Thor chegou")).toBeVisible();
  await expect(thor.getByRole("button", { name: "Começar atendimento" })).toBeVisible();

  // 5. Detalhe e cancelamento: a vaga volta.
  await thor.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Thor" })).toBeVisible();
  await snap(page, "22-agendamento");
  await page.getByRole("button", { name: "Cancelar agendamento" }).click();
  await page.getByLabel("Motivo").fill("Tutor remarcou");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar agendamento" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/agenda\\?data=${date}&cancelado=1`));
  await expect(page.getByText("Cancelados e faltas (1)")).toBeVisible();
});
