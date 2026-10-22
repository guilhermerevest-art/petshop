import { expect, test, type Page } from "@playwright/test";
import { signUp, snap, uniqueEmail } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "a página não pode rolar para os lados").toBeLessThanOrEqual(0);
}

test("telas cabem no celular sem rolagem horizontal", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  await snap(page, "m01-site");

  await signUp(page, {
    shop: "Pet Shop Celular",
    name: "Dani Rocha",
    email: uniqueEmail("mobile"),
  });
  await expect(page).toHaveURL(/\/app\/assinatura$/);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await page.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/dados$/);

  for (const path of [
    "/app/configurar/dados",
    "/app/configurar/horarios",
    "/app/configurar/servicos",
    "/app/configurar/pix",
    "/app/configurar/whatsapp",
    "/app/configurar/equipe",
    "/app",
    "/app/agenda",
    "/app/agenda/novo",
    "/app/clientes",
    "/app/clientes/novo",
    "/app/configuracoes/horarios",
    "/app/comandas",
    "/app/caixa",
    "/app/produtos",
    "/app/comissoes",
  ]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await snap(page, `m-${path.replaceAll("/", "_")}`);
  }

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await snap(page, "m-menu");
  await page.getByRole("link", { name: "Horários e vagas" }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/horarios$/);
});
