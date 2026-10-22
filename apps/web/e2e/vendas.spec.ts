import { expect, test } from "@playwright/test";
import { bookNewCustomer, nextWeekday, signUp, snap, uniqueEmail } from "./helpers";

test("venda: estoque, caixa, comanda do atendimento com PIX e dinheiro, recibo", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signUp(page, { shop: "Pet Shop Caixa", name: "Lia Prado", email: uniqueEmail("vendas") });
  await page.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await page.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/dados$/);

  await page.goto("/app/configurar/horarios");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/servicos$/);
  await page.getByRole("button", { name: "Adicionar serviços marcados" }).click();
  await expect(page.getByText("Banho e tosa na tesoura")).toBeVisible();
  await page.goto("/app/configurar/pix");
  await page.getByText("CNPJ", { exact: true }).click();
  await page.getByLabel("Chave PIX").fill("11.222.333/0001-81");
  await page.getByLabel("Cidade").fill("Campinas");
  await page.getByRole("button", { name: "Salvar chave PIX" }).click();
  await expect(page.getByRole("img", { name: /QR Code PIX de teste/ })).toBeVisible();

  // 1. Produto com estoque inicial e uma entrada.
  await page.goto("/app/produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Petisco de frango");
  await dialog.getByLabel("Preço de venda (R$)").fill("15");
  await dialog.getByLabel("Custo (R$)").fill("9");
  await dialog.getByLabel("Quantidade em estoque agora").fill("10");
  await dialog.getByLabel("Avisar quando chegar a").fill("3");
  await dialog.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Petisco de frango" })).toBeVisible();
  await expect(page.getByText("margem 40%")).toBeVisible();
  await page.getByLabel("Quantidade", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Registrar entrada" }).click();
  await expect(page.getByText("Estoque de Petisco de frango: 15 unidades")).toBeVisible();

  // 2. Abrir o caixa com troco.
  await page.goto("/app/caixa");
  await page.getByLabel("Troco na gaveta (R$)").fill("50");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(page.getByText("Dinheiro esperado na gaveta")).toBeVisible();

  // 3. Atendimento: chegou, então dá para cobrar.
  const date = nextWeekday();
  await bookNewCustomer(page, {
    date,
    name: "Paula Reis",
    phone: "(19) 99333-4455",
    pet: "Bolt",
    weight: "7",
    service: /^Banho R\$/,
    time: "10:00",
  });
  const bolt = page
    .getByRole("listitem")
    .filter({ hasText: "Bolt" })
    .filter({ hasText: "Paula Reis" });
  await bolt.getByRole("button", { name: "Registrar chegada" }).click();
  await expect(page.getByText("Bolt chegou")).toBeVisible();
  await bolt.getByRole("link").first().click();
  await page.getByRole("button", { name: "Cobrar" }).click();
  await expect(page).toHaveURL(/\/app\/comandas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Comanda 1");

  // 4. Inclui 2 petiscos: R$ 50 + R$ 30 = R$ 80.
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByRole("dialog").getByLabel("Quantidade").fill("2");
  await page.getByRole("dialog").getByRole("button", { name: "Incluir na comanda" }).click();
  await expect(page.getByText("2× Petisco de frango")).toBeVisible();
  await expect(page.getByText("Falta")).toContainText("80,00");

  // 5. Parte no PIX (conferido) e o resto em dinheiro com troco.
  await page.getByLabel("Valor (R$)").fill("50");
  await page.getByRole("button", { name: "Gerar PIX" }).click();
  await expect(page.getByRole("img", { name: /QR Code PIX de R\$/ })).toBeVisible();
  await snap(page, "30-comanda-pix");
  await page.getByRole("button", { name: "Recebi o PIX" }).click();
  await expect(page.getByText(/PIX de R\$\s50,00 confirmado/)).toBeVisible();

  await page.getByText("Dinheiro", { exact: true }).click();
  await expect(page.getByLabel("Valor (R$)")).toHaveValue("30,00");
  await page.getByLabel("Recebido (R$)").fill("50");
  await expect(page.getByText(/Troco:\s*R\$\s20,00/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText(/Comanda paga/).first()).toBeVisible();
  await expect(page.getByText("Paga", { exact: true }).first()).toBeVisible();
  await snap(page, "31-comanda-paga");

  // 6. Recibo público.
  const receiptHref = await page.getByRole("link", { name: "Ver recibo" }).getAttribute("href");
  expect(receiptHref).toMatch(/\/recibo\//);

  // 7. Estoque baixou e o caixa fecha certinho (50 de troco + 30 em dinheiro).
  await page.goto("/app/produtos");
  await expect(page.getByText("13 em estoque")).toBeVisible();
  await page.goto("/app/caixa");
  await expect(page.getByText(/troco inicial R\$\s50,00 \+ dinheiro R\$\s30,00/)).toBeVisible();
  await snap(page, "32-caixa");
  await page.getByLabel("Dinheiro contado na gaveta (R$)").fill("80");
  await expect(page.getByText("Bateu certinho.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(page.getByText("Caixa fechado. O dinheiro bateu.")).toBeVisible();

  await page.goto(new URL(receiptHref!).pathname);
  await expect(page.getByText("Recibo da comanda 1")).toBeVisible();
  await expect(page.getByText("Cliente: Paula Reis")).toBeVisible();
  await expect(page.getByText("Total pago")).toBeVisible();
  await snap(page, "33-recibo");
});
