import { isAPIError } from "better-auth/api";

export function authErrorCode(error: unknown): string | null {
  if (isAPIError(error)) {
    const body = error.body as { code?: string } | undefined;
    return body?.code ?? null;
  }
  return null;
}

const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre com sua senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com este e-mail. Entre com sua senha.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_EMAIL: "Este e-mail não é válido.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  INVALID_TOKEN: "Este link expirou ou já foi usado. Peça um novo.",
  INVITATION_NOT_FOUND: "Este convite não existe mais. Peça um novo para quem convidou você.",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "Esta pessoa já faz parte da equipe.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "Esta pessoa já tem um convite pendente.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "Este convite foi enviado para outro e-mail.",
};

export function authErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir. Tente de novo.",
): string {
  const code = authErrorCode(error);
  return (code && MESSAGES[code]) ?? fallback;
}

/** Converte os Set-Cookie de uma resposta da autenticação num cabeçalho Cookie para a próxima chamada. */
export function cookieHeaderFrom(headers: Headers): Headers {
  const cookies = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");
  return new Headers({ cookie: cookies });
}
