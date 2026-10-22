"use client";

import { useState } from "react";
import Link from "next/link";
import { centsToInput, formatBRL, parseBRL } from "@petshop/core";
import type { PaymentMethod } from "@petshop/db/schema";
import { fieldError } from "@/components/action-feedback";
import { useImmediateAction } from "@/components/use-immediate-action";
import { ActionForm } from "@/components/ui/action-form";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { addPaymentAction } from "@/server/sales-actions";

/** Lança um pagamento. O valor começa com o que falta; dá para dividir em várias formas. */
export function PaymentForm({
  orderId,
  remainingCents,
  cashOpen,
  hasPix,
}: {
  orderId: string;
  remainingCents: number;
  cashOpen: boolean;
  hasPix: boolean;
}) {
  // O formulário recomeça depois de cada pagamento, então o aviso de sucesso sai na hora.
  const [state, action] = useImmediateAction(addPaymentAction);
  const [method, setMethod] = useState<PaymentMethod>(hasPix ? "pix" : "dinheiro");
  const [amount, setAmount] = useState(centsToInput(remainingCents));
  const [received, setReceived] = useState("");
  const amountCents = parseBRL(amount) ?? 0;
  const receivedCents = parseBRL(received);
  const change =
    receivedCents !== null && receivedCents > amountCents ? receivedCents - amountCents : 0;

  return (
    <ActionForm action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="orderId" value={orderId} />
      <ChoiceCards
        name="method"
        value={method}
        onChange={setMethod}
        options={[
          {
            value: "pix",
            label: "PIX",
            description: hasPix ? "QR Code na tela" : "Cadastre a chave",
          },
          {
            value: "dinheiro",
            label: "Dinheiro",
            description: cashOpen ? "Calcula o troco" : "Caixa fechado",
          },
          { value: "debito", label: "Débito" },
          { value: "credito", label: "Crédito" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" error={fieldError(state, "amount")}>
          {(props) => (
            <Input
              {...props}
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular"
            />
          )}
        </Field>
        {method === "dinheiro" ? (
          <Field label="Recebido (R$)" optional error={fieldError(state, "received")}>
            {(props) => (
              <Input
                {...props}
                name="received"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={amount}
                className="tabular"
              />
            )}
          </Field>
        ) : null}
      </div>
      {method === "dinheiro" && change > 0 ? (
        <p className="rounded-campo bg-patinho-claro px-4 py-3 text-lg font-[650]">
          Troco: <span className="tabular">{formatBRL(change)}</span>
        </p>
      ) : null}
      {method === "dinheiro" && !cashOpen ? (
        <Notice tone="warning">
          Para receber em dinheiro,{" "}
          <Link href="/app/caixa" className="font-medium underline underline-offset-2">
            abra o caixa
          </Link>
          .
        </Notice>
      ) : null}
      {method === "pix" && !hasPix ? (
        <Notice tone="warning">
          Cadastre a chave PIX em{" "}
          <Link href="/app/configuracoes/pix" className="font-medium underline underline-offset-2">
            Configurações
          </Link>{" "}
          para gerar o QR Code.
        </Notice>
      ) : null}
      <SubmitButton size="lg" pendingLabel="Lançando…" disabled={method === "pix" && !hasPix}>
        {method === "pix" ? "Gerar PIX" : "Registrar pagamento"}
      </SubmitButton>
    </ActionForm>
  );
}
