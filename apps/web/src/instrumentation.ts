/** Roda uma vez quando o servidor sobe. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkDatabaseRole } = await import("@petshop/db");
  const { db } = await import("./lib/db");
  try {
    const check = await checkDatabaseRole(db());
    if (check.bypassesRls) {
      console.error(
        `[segurança] O usuário do banco "${check.role}" é superusuário ou tem BYPASSRLS: o isolamento entre pet shops ` +
          "não funcionaria. Use o papel da aplicação (ver docs/infra.md). O sistema vai recusar requisições até corrigir.",
      );
    }
  } catch (error) {
    console.error("[segurança] Não foi possível conferir o usuário do banco", error);
  }
}
