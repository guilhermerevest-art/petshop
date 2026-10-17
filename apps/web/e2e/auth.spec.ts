import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("entrar, sair e mensagens de erro claras", async ({ page }) => {
  const email = uniqueEmail("login");
  await signUp(page, { shop: "Pet Shop Login", name: "Carla Dias", email });
  await expect(page).toHaveURL(/\/app\/assinatura$/);

  // Sem assinatura, as outras telas levam para a assinatura
  await page.goto("/app/configuracoes/horarios");
  await expect(page).toHaveURL(/\/app\/assinatura$/);

  await page.getByRole("button", { name: "Sair" }).first().click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

  await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/assinatura$/);

  // E-mail repetido no cadastro
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage, { shop: "Outro", name: "Outra Pessoa", email });
  await expect(otherPage.getByText("Já existe uma conta com este e-mail. Entre com sua senha.")).toBeVisible();
  await other.close();
});

test("dados de um pet shop não aparecem para outro", async ({ page, browser }) => {
  await signUp(page, { shop: "Pet Shop Alfa", name: "Alfa Dono", email: uniqueEmail("alfa") });
  await page.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await page.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/dados$/);
  await page.goto("/app/configurar/servicos");
  await page.getByRole("button", { name: "Adicionar serviços marcados" }).click();
  await expect(page.getByText("Banho e tosa na tesoura")).toBeVisible();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage, { shop: "Pet Shop Beta", name: "Beta Dona", email: uniqueEmail("beta") });
  await otherPage.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await otherPage.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(otherPage).toHaveURL(/\/app\/configurar\/dados$/);
  await otherPage.goto("/app/configurar/servicos");
  await expect(otherPage.getByRole("heading", { name: "Comece pela lista sugerida" })).toBeVisible();
  await expect(otherPage.getByText("Banho e tosa na tesoura")).toBeVisible(); // só na lista sugerida
  await expect(otherPage.getByRole("button", { name: /^Editar / })).toHaveCount(0);
  await other.close();
});
