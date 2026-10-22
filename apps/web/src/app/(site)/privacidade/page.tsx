import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[70ch] px-4 py-10 sm:px-8">
      <h1 className="text-[32px]">Política de privacidade</h1>
      <p className="mt-2 text-sm text-tinta-suave">Versão preliminar, em revisão jurídica.</p>
      <div className="mt-8 flex flex-col gap-4 text-[17px] leading-relaxed">
        <p>
          Tratamos dados pessoais de duas formas: dos donos e equipes dos pet shops (para prestar o
          serviço e cobrar a assinatura) e dos tutores atendidos pelos pet shops (em nome de cada
          pet shop, que é o controlador desses dados).
        </p>
        <h2 className="mt-4 text-xl">O que coletamos</h2>
        <p>
          Nome, e-mail, celular e dados de acesso da equipe; dados cadastrais do pet shop; e,
          inseridos pelo pet shop, dados dos tutores e dos pets. Dados de cartão são tratados apenas
          pelo Stripe.
        </p>
        <h2 className="mt-4 text-xl">Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção, exportação ou exclusão dos seus dados. Tutores devem
          fazer o pedido ao pet shop que os atende; nós ajudamos o pet shop a cumpri-lo.
        </p>
        <h2 className="mt-4 text-xl">Segurança</h2>
        <p>
          Os dados de cada pet shop ficam isolados dos demais, as conexões são criptografadas e os
          acessos da equipe de suporte ficam registrados.
        </p>
      </div>
    </main>
  );
}
