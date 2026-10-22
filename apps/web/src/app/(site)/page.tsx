import Link from "next/link";
import { formatBRL } from "@petshop/core";
import { DayBoard } from "@/components/day-board";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatInterval } from "@/lib/format";
import { billing } from "@/lib/providers";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Vagas por horário",
    text: "Você diz quantos pets atende em cada horário. Serviços longos ocupam as vagas de todos os horários que cobrem, e a agenda nunca passa do que a equipe dá conta.",
    soon: false,
  },
  {
    title: "WhatsApp do seu número",
    text: "Confirmação, lembrete na véspera, aviso de pet pronto com foto e recibo saem do WhatsApp do próprio pet shop. O celular continua funcionando normalmente.",
    soon: false,
  },
  {
    title: "PIX direto na sua conta",
    text: "O QR Code usa a sua chave. O dinheiro cai na conta do pet shop, sem intermediário e sem taxa por venda.",
    soon: false,
  },
  {
    title: "Checklist e histórico do pet",
    text: "Como o pet chegou, o que foi feito e como saiu, com fotos. Protege o pet shop e mostra cuidado ao tutor.",
    soon: true,
  },
  {
    title: "Tutor agenda sozinho",
    text: "Um link do pet shop onde o tutor escolhe o serviço e um horário com vaga, sem precisar ligar.",
    soon: true,
  },
  {
    title: "Clientes que voltam",
    text: "Lembrete de banho na data certa, pacotes e campanhas para quem sumiu. O sistema trabalha para o tutor voltar.",
    soon: true,
  },
];

const FAQ = [
  {
    q: "O pagamento do cliente passa pela plataforma?",
    a: "Não. O PIX vai direto para a conta do pet shop. A plataforma só cobra a mensalidade do sistema.",
  },
  {
    q: "Meu WhatsApp continua funcionando no celular?",
    a: "Sim. O sistema se conecta como um aparelho a mais, igual ao WhatsApp Web. Vocês seguem conversando com os clientes pelo celular.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Funciona no navegador do computador, do tablet e do celular.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode, sem multa. Seus dados ficam disponíveis para exportar por 90 dias depois do fim da assinatura.",
  },
];

export default async function LandingPage() {
  const plan = await billing()
    .getPlan()
    .catch(() => null);

  return (
    <main>
      <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 pt-10 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-16">
        <div>
          <h1 className="text-[38px] leading-[1.1] sm:text-[48px]">
            Agenda, WhatsApp e PIX do seu banho e tosa num lugar só
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg text-tinta-suave">
            Defina quantos pets você atende por horário, avise os tutores pelo WhatsApp do próprio
            pet shop e receba por PIX direto na sua conta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/criar-conta" className={buttonClasses({ size: "lg" })}>
              {plan && plan.trialDays > 0
                ? `Testar grátis por ${plan.trialDays} dias`
                : "Criar conta"}
            </Link>
            <Link href="/entrar" className={buttonClasses({ size: "lg", variant: "secondary" })}>
              Já tenho conta
            </Link>
          </div>
        </div>
        <DayBoard />
      </section>

      <section className="border-y border-rejunte bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-8">
          <h2 className="text-[28px]">Pronto para usar em uma tarde</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["Crie a conta", "Informe o nome do pet shop e ative o teste grátis."],
              [
                "Configure o essencial",
                "Horários e vagas, serviços com preço por porte e a chave PIX. Uma lista sugerida adianta o trabalho.",
              ],
              [
                "Conecte o WhatsApp",
                "Leia um QR Code com o celular do pet shop e mande uma mensagem de teste.",
              ],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-azulejo bg-azulejo text-white tabular"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block text-lg font-[650]">{title}</span>
                  <span className="mt-1 block text-tinta-suave">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-20 sm:px-8">
        <h2 className="max-w-[24ch] text-[28px]">Feito para a rotina de quem dá banho e tosa</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="border-t border-rejunte-forte pt-5">
              <dt className="flex items-center gap-3 text-lg font-[650]">
                {feature.title}
                {feature.soon ? <Badge>Em breve</Badge> : null}
              </dt>
              <dd className="mt-2 max-w-[60ch] text-tinta-suave">{feature.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 sm:px-8" aria-labelledby="preco">
        <div className="grid gap-10 rounded-painel bg-tinta px-6 py-10 text-white sm:px-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 id="preco" className="text-[28px]">
              Um plano, tudo incluído
            </h2>
            <p className="mt-2 max-w-[50ch] text-white/75">
              Equipe sem limite de pessoas, WhatsApp do seu número e PIX sem taxa. Cancele quando
              quiser.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            {plan ? (
              <p>
                <span className="text-[44px] font-[650] tabular">
                  {formatBRL(plan.amountCents)}
                </span>{" "}
                <span className="text-white/75">{formatInterval(plan.interval)}</span>
              </p>
            ) : null}
            <Link
              href="/criar-conta"
              className={buttonClasses({
                size: "lg",
                className: "bg-patinho text-tinta hover:bg-[#ffc94f]",
              })}
            >
              {plan && plan.trialDays > 0 ? "Começar teste grátis" : "Criar conta"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-4 pt-20 sm:px-8" aria-labelledby="duvidas">
        <h2 id="duvidas" className="text-[28px]">
          Dúvidas comuns
        </h2>
        <div className="mt-6 divide-y divide-rejunte border-y border-rejunte">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-lg font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-2 text-tinta-suave">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
