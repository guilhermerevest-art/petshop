"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { formatBrPhone } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionButton } from "@/components/action-button";
import { buttonClasses, Button } from "@/components/ui/button";
import { Checkbox, ChoiceCards } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelSection } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import type { WhatsAppView } from "@/lib/whatsapp";
import {
  cancelWhatsAppAction,
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  sendTestMessageAction,
} from "@/server/whatsapp-actions";

const POLL_MS = 3000;

function formatPairing(code: string | null) {
  if (!code) return null;
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function WhatsAppConnect({
  initial,
  defaultPhone,
  nextHref,
}: {
  initial: WhatsAppView;
  defaultPhone: string | null;
  /** No assistente: para onde ir depois de conectar. */
  nextHref?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"qr" | "code">("qr");
  const [state, connectAction] = useActionState(connectWhatsAppAction, null);
  const [, startTransition] = useTransition();
  const announced = useRef(initial.status === "connected");

  // O que a tela mostra: o estado vindo do servidor, sobreposto pelo resultado da conexão e pelas consultas.
  const [override, setOverride] = useState<WhatsAppView | null>(null);
  const [seenInitial, setSeenInitial] = useState(initial);
  const [seenState, setSeenState] = useState(state);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setOverride(null);
  }
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok && state.data) setOverride(state.data);
  }
  const view = override ?? initial;

  // Enquanto espera a leitura, consulta o estado e renova o QR Code.
  useEffect(() => {
    if (view.status !== "connecting") return;
    let stopped = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/whatsapp/status?qr=1", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as WhatsAppView;
        if (stopped) return;
        setOverride((current) => ({
          ...next,
          // Mantém o código de pareamento já mostrado enquanto a pessoa digita.
          pairingCode: next.pairingCode ?? current?.pairingCode ?? null,
          qrCode: next.qrCode ?? current?.qrCode ?? null,
        }));
      } catch {
        // rede instável: tenta de novo no próximo ciclo
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [view.status]);

  useEffect(() => {
    if (view.status === "connected" && !announced.current) {
      announced.current = true;
      toast.success("WhatsApp conectado");
      startTransition(() => router.refresh());
    }
  }, [view.status, router]);

  if (view.status === "connected") {
    return <Connected view={view} defaultPhone={defaultPhone} nextHref={nextHref} />;
  }

  if (view.status === "connecting") {
    const pairing = formatPairing(view.pairingCode);
    return (
      <Panel>
        <PanelSection className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
          <div>
            <h2 className="text-xl">{pairing ? "Digite o código no celular" : "Leia o QR Code com o celular do pet shop"}</h2>
            <ol className="mt-4 flex flex-col gap-3 text-[15px]">
              {[
                "Abra o WhatsApp no celular do pet shop.",
                "Toque em Mais opções (⋮) no Android ou em Configurações no iPhone.",
                "Toque em Aparelhos conectados e depois em Conectar aparelho.",
                pairing
                  ? "Toque em Conectar com número de telefone e digite o código ao lado."
                  : "Aponte a câmera do celular para o código ao lado.",
              ].map((text, index) => (
                <li key={text} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-azulejo bg-azulejo-claro text-sm font-medium text-azulejo-escuro tabular">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-center gap-2 text-sm text-tinta-suave" aria-live="polite">
              <Spinner className="text-azulejo" /> Aguardando a conexão. Esta tela atualiza sozinha.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            {pairing ? (
              <p
                className="rounded-painel border-2 border-dashed border-azulejo/40 bg-azulejo-claro/50 px-6 py-8 text-center text-[34px] font-[650] tracking-[0.12em] tabular"
                aria-label={`Código ${pairing.split("").join(" ")}`}
              >
                {pairing}
              </p>
            ) : view.qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.qrCode}
                alt="QR Code para conectar o WhatsApp"
                width={264}
                height={264}
                className="size-[264px] rounded-painel border border-rejunte bg-white p-2"
              />
            ) : (
              <div className="flex size-[264px] items-center justify-center rounded-painel border border-rejunte bg-espuma">
                <Spinner className="size-6 text-azulejo" />
              </div>
            )}
            <p className="text-center text-sm text-tinta-suave">
              {pairing ? "O código vale por alguns minutos." : "O código se renova sozinho até ser lido."}
            </p>
          </div>
        </PanelSection>
        <PanelSection>
          <ActionForm action={cancelWhatsAppAction}>
            <Button type="submit" variant="ghost">
              Cancelar e escolher outra forma
            </Button>
          </ActionForm>
        </PanelSection>
      </Panel>
    );
  }

  return (
    <Panel>
      <ActionForm action={connectAction}>
        <PanelSection className="flex flex-col gap-5">
          <ActionFeedback state={state} />
          {initial.connectedAt ? (
            <Notice tone="warning" title="O WhatsApp está desconectado.">
              As mensagens para os clientes ficam guardadas e são enviadas quando você conectar de novo.
            </Notice>
          ) : null}
          <ChoiceCards
            name="method"
            legend="Como você prefere conectar?"
            value={method}
            onChange={setMethod}
            options={[
              { value: "qr", label: "Ler um QR Code", description: "Melhor se você está no computador e tem o celular do pet shop por perto." },
              { value: "code", label: "Digitar um código no celular", description: "Melhor se você está configurando pelo próprio celular do pet shop." },
            ]}
          />
          {method === "code" ? (
            <Field label="Número do WhatsApp do pet shop" error={fieldError(state, "phone")}>
              {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" placeholder="(19) 98765-4321" defaultValue={defaultPhone ? formatBrPhone(defaultPhone) : ""} />}
            </Field>
          ) : null}
        </PanelSection>
        <PanelSection className="flex flex-col gap-4 bg-espuma/60">
          <p className="font-medium">Antes de conectar</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-tinta-suave">
            <li>Use, de preferência, um número só do pet shop.</li>
            <li>O celular continua funcionando normalmente: vocês seguem conversando com os clientes por ele.</li>
            <li>
              A conexão usa o WhatsApp Web. Enviar muitas mensagens para quem não espera pode fazer o WhatsApp bloquear o número. O
              sistema só envia o que o cliente espera receber: confirmações, lembretes e recibos.
            </li>
          </ul>
          <Checkbox name="terms" required defaultChecked={initial.termsAccepted} label="Li e entendi as orientações." />
          {fieldError(state, "terms") ? <p className="text-sm font-medium text-alerta">{fieldError(state, "terms")}</p> : null}
          <div>
            <SubmitButton size="lg" pendingLabel="Preparando…">
              <Smartphone className="size-5" aria-hidden /> Conectar WhatsApp
            </SubmitButton>
          </div>
        </PanelSection>
      </ActionForm>
    </Panel>
  );
}

function Connected({ view, defaultPhone, nextHref }: { view: WhatsAppView; defaultPhone: string | null; nextHref?: string }) {
  const [testState, testAction] = useActionState(sendTestMessageAction, null);
  const initials = (view.profileName ?? "WA").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelSection className="flex items-center gap-4">
          {view.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.profilePictureUrl} alt="" className="size-14 rounded-full border border-rejunte object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-azulejo-claro text-lg font-[650] text-azulejo-escuro">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-5 text-azulejo" aria-hidden /> Conectado
            </p>
            <p className="truncate text-tinta-suave">
              {[view.profileName, view.phoneNumber ? formatBrPhone(view.phoneNumber) : null].filter(Boolean).join(", ")}
            </p>
          </div>
        </PanelSection>
        <PanelSection>
          <ActionForm action={testAction} className="flex flex-col gap-4">
            <ActionFeedback state={testState} />
            <Field
              label="Enviar uma mensagem de teste para"
              hint="Use seu próprio celular para ver como a mensagem chega."
              error={fieldError(testState, "phone")}
            >
              {(props) => (
                <Input {...props} name="phone" type="tel" inputMode="tel" defaultValue={defaultPhone ? formatBrPhone(defaultPhone) : ""} placeholder="(19) 98765-4321" className="max-w-xs" />
              )}
            </Field>
            <div>
              <SubmitButton variant="secondary" pendingLabel="Enviando…">
                Enviar mensagem de teste
              </SubmitButton>
            </div>
          </ActionForm>
        </PanelSection>
        <PanelSection>
          <details>
            <summary className="cursor-pointer text-[15px] text-tinta-suave">Desconectar este número</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[15px] text-tinta-suave">
                Os clientes param de receber confirmações e lembretes até você conectar um número de novo.
              </p>
              <ActionButton action={disconnectWhatsAppAction} variant="danger" pendingLabel="Desconectando…">
                Desconectar WhatsApp
              </ActionButton>
            </div>
          </details>
        </PanelSection>
      </Panel>
      {nextHref ? (
        <div>
          <Link href={nextHref} className={buttonClasses({ size: "lg" })}>
            Continuar
          </Link>
        </div>
      ) : null}
    </div>
  );
}
