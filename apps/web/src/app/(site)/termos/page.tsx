import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[70ch] px-4 py-10 sm:px-8">
      <h1 className="text-[32px]">Termos de uso</h1>
      <p className="mt-2 text-sm text-tinta-suave">Versão preliminar, em revisão jurídica.</p>
      <div className="mt-8 flex flex-col gap-4 text-[17px] leading-relaxed">
        <p>
          Estes termos regem o uso da plataforma PetShop por pet shops assinantes e suas equipes. Ao criar uma conta, você
          declara ter poderes para representar o pet shop cadastrado.
        </p>
        <h2 className="mt-4 text-xl">Assinatura</h2>
        <p>
          O acesso é cobrado por assinatura recorrente, processada pelo Stripe. Com o pagamento atrasado, o sistema passa a
          funcionar só para consulta depois de 7 dias e é suspenso depois de 30 dias. Após o cancelamento, os dados ficam
          disponíveis para exportação por 90 dias e depois são excluídos.
        </p>
        <h2 className="mt-4 text-xl">WhatsApp</h2>
        <p>
          A conexão do WhatsApp usa o protocolo do WhatsApp Web e não é um produto oficial da Meta. O pet shop é responsável
          pelo conteúdo e pelos destinatários das mensagens e deve enviá-las apenas a clientes que esperam recebê-las. A
          plataforma não se responsabiliza por bloqueios do número aplicados pelo WhatsApp.
        </p>
        <h2 className="mt-4 text-xl">Pagamentos dos clientes</h2>
        <p>
          Os pagamentos por PIX vão diretamente para a conta do pet shop. A plataforma não intermedia nem guarda esses valores.
        </p>
        <h2 className="mt-4 text-xl">Dados</h2>
        <p>
          O pet shop é o controlador dos dados dos seus clientes e a plataforma atua como operadora, nos termos da LGPD. Veja a
          política de privacidade.
        </p>
      </div>
    </main>
  );
}
