import { expect, test } from "@playwright/test";
import { signUp, snap, uniqueEmail } from "./helpers";

test("pet shop novo: conta, assinatura, configuração completa e convite da equipe", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Agenda, WhatsApp e PIX");
  await snap(page, "01-site");

  // 1. Criar conta
  const ownerEmail = uniqueEmail("dono");
  await signUp(page, { shop: "Pet Shop Bom Banho", name: "Ana Souza", email: ownerEmail });
  await expect(page).toHaveURL(/\/app\/assinatura$/);
  await expect(page.getByRole("heading", { name: "Ative a assinatura do pet shop" })).toBeVisible();
  await snap(page, "02-assinatura");

  // 2. Assinar (checkout simulado)
  await page.getByRole("button", { name: /Começar teste grátis|Assinar/ }).click();
  await expect(page).toHaveURL(/\/app\/assinatura\/simulada/);
  await page.getByRole("button", { name: "Ativar assinatura de teste" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/dados$/);

  // 3. Dados do pet shop
  await expect(page.getByLabel("Nome do pet shop")).toHaveValue("Pet Shop Bom Banho");
  await page.getByLabel("Cidade").fill("Campinas");
  await page.getByLabel("Estado").selectOption("SP");
  await snap(page, "03-dados");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/horarios$/);

  // 4. Horários e vagas
  await expect(page.getByText(/vagas por semana/)).toBeVisible();
  await snap(page, "04-horarios");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/servicos$/);

  // 5. Serviços (lista sugerida)
  await page.getByRole("button", { name: "Adicionar serviços marcados" }).click();
  await expect(page.getByRole("heading", { name: "Adicionais" })).toBeVisible();
  await expect(page.getByText("Banho e tosa na tesoura")).toBeVisible();
  await snap(page, "05-servicos");
  await page.getByRole("button", { name: "Editar Banho", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await snap(page, "05b-editar-servico");
  await page.getByRole("button", { name: "Salvar serviço" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/pix$/);

  // 6. PIX
  await page.getByText("CNPJ", { exact: true }).click();
  await page.getByLabel("Chave PIX").fill("11.222.333/0001-81");
  await page.getByRole("button", { name: "Salvar chave PIX" }).click();
  await expect(
    page.getByRole("heading", { name: "Teste antes de usar com clientes" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /QR Code PIX de teste/ })).toBeVisible();
  await snap(page, "06-pix");
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/whatsapp$/);

  // 7. WhatsApp (simulado: conecta sozinho alguns segundos depois do QR Code)
  await page.getByRole("checkbox", { name: "Li e entendi as orientações." }).check();
  await page.getByRole("button", { name: "Conectar WhatsApp" }).click();
  await expect(page.getByRole("img", { name: "QR Code para conectar o WhatsApp" })).toBeVisible();
  await snap(page, "07-whatsapp-qr");
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByText("Mensagem de teste enviada")).toBeVisible();
  await snap(page, "07b-whatsapp-conectado");
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/equipe$/);

  // 8. Equipe: criar o acesso de uma banhista (usuário e senha, sem e-mail)
  const username = `bruno.${Date.now().toString(36)}`;
  await page.getByLabel("Nome", { exact: true }).fill("Bruno Lima");
  await expect(page.getByLabel("Usuário para entrar")).toHaveValue(/^bruno\./);
  await page.getByLabel("Usuário para entrar").fill(username);
  await page.getByLabel("Senha", { exact: true }).fill("banho-forte-42");
  await page.getByLabel(/Celular com WhatsApp/).fill("(19) 99876-5432");
  await page.getByText("Banhista ou tosador", { exact: true }).click();
  await page.getByRole("button", { name: "Criar acesso" }).click();
  await expect(page.getByText("Acesso de Bruno Lima criado.")).toBeVisible();
  await expect(page.getByText("Também enviamos pelo WhatsApp.")).toBeVisible();
  await expect(page.getByText(`Usuário: ${username}`)).toBeVisible();
  await snap(page, "08-equipe");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/app\/configurar\/pronto$/);
  await expect(page.getByRole("heading", { name: "Tudo pronto!" })).toBeVisible();

  // 9. Início
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
  await expect(page.getByText("Termine de configurar o pet shop")).toBeHidden();
  await snap(page, "09-inicio");

  // 10. A banhista entra com usuário e senha, troca a própria senha e não vê o que não deve
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await staffPage.goto("/entrar");
  await staffPage.getByLabel("E-mail ou usuário").fill(username.toUpperCase());
  await staffPage.getByLabel("Senha", { exact: true }).fill("banho-forte-42");
  await staffPage.getByRole("button", { name: "Entrar" }).click();
  await expect(staffPage).toHaveURL(/\/app$/);
  await expect(staffPage.getByRole("heading", { name: "Olá, Bruno" })).toBeVisible();
  await expect(staffPage.getByRole("link", { name: "Assinatura" })).toHaveCount(0);
  await staffPage.goto("/app/configuracoes/horarios");
  await expect(staffPage).toHaveURL(/aviso=sem-permissao/);
  await staffPage.goto("/app/conta");
  await expect(staffPage.getByText(username)).toBeVisible();
  await staffPage.getByLabel("Senha atual").fill("banho-forte-42");
  await staffPage.getByLabel("Nova senha").fill("minha-senha-nova");
  await staffPage.getByRole("button", { name: "Trocar senha" }).click();
  await expect(staffPage).toHaveURL(/\/app\/conta\?senha=alterada$/);
  await expect(staffPage.getByText("Senha alterada.")).toBeVisible();
  await snap(staffPage, "10-minha-conta");

  // O dono define uma nova senha: a sessão da banhista termina e só a senha nova funciona
  await page.goto("/app/configuracoes/equipe");
  await page.getByText("Definir nova senha").click();
  await page.getByLabel("Nova senha para Bruno").fill("redefinida-pelo-dono");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Nova senha de Bruno.")).toBeVisible();
  await staffPage.goto("/app");
  await expect(staffPage).toHaveURL(/\/entrar/);
  await staffPage.getByLabel("E-mail ou usuário").fill(username);
  await staffPage.getByLabel("Senha", { exact: true }).fill("minha-senha-nova");
  await staffPage.getByRole("button", { name: "Entrar" }).click();
  await expect(staffPage.getByText("Usuário ou senha incorretos.")).toBeVisible();
  await staffPage.getByLabel("Senha", { exact: true }).fill("redefinida-pelo-dono");
  await staffPage.getByRole("button", { name: "Entrar" }).click();
  await expect(staffPage).toHaveURL(/\/app$/);

  // Removida da equipe, perde o acesso na hora
  await page.reload();
  await page.getByText("Remover da equipe").click();
  await page.getByRole("button", { name: "Remover Bruno" }).click();
  await expect(page.getByText("Bruno saiu da equipe")).toBeVisible();
  await expect(page.getByText(`Usuário: ${username}`)).toHaveCount(0);
  await staffPage.goto("/app");
  await expect(staffPage).toHaveURL(/\/entrar/);
  await staff.close();

  // 11. Inadimplência: 10 dias de atraso deixam o sistema só para consulta
  await page.goto("/app/assinatura/simulada");
  await page.getByRole("button", { name: /Atrasada há 10 dias/ }).click();
  await page.goto("/app/configuracoes/dados");
  await expect(page.getByText(/só para consulta/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText(/pagamento pendente/)).toBeVisible();
  await snap(page, "11-somente-leitura");
  await page.goto("/app/assinatura/simulada");
  await page.getByRole("button", { name: "Em dia" }).click();
});
