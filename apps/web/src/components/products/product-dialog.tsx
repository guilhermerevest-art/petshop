"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { centsToInput } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveProductAction } from "@/server/product-actions";

export interface ProductValues {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  priceCents: number;
  costCents: number | null;
  trackStock: boolean;
  minStock: number;
}

export function ProductDialog({
  product,
  variant = "primary",
}: {
  product?: ProductValues;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {product ? (
          "Editar"
        ) : (
          <>
            <Plus className="size-4" aria-hidden /> Novo produto
          </>
        )}
      </Button>
      {open ? (
        <Sheet
          open
          onOpenChange={setOpen}
          title={product ? `Editar ${product.name}` : "Novo produto"}
        >
          <ProductForm product={product} onDone={() => setOpen(false)} />
        </Sheet>
      ) : null}
    </>
  );
}

function ProductForm({ product, onDone }: { product?: ProductValues; onDone: () => void }) {
  const [state, action] = useActionState(saveProductAction, null);
  const [track, setTrack] = useState(product?.trackStock ?? true);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      onDone();
      if (!product && state.data) router.push(`/app/produtos/${state.data.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const err = (name: string) => fieldError(state, name);
  return (
    <ActionForm action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <Field label="Nome" error={err("name")}>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={product?.name}
            placeholder="Ex.: Petisco de frango 100 g"
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Preço de venda (R$)" error={err("price")}>
          {(props) => (
            <Input
              {...props}
              name="price"
              inputMode="decimal"
              defaultValue={product ? centsToInput(product.priceCents) : ""}
              placeholder="0,00"
            />
          )}
        </Field>
        <Field label="Custo (R$)" optional error={err("cost")} hint="Para saber a margem.">
          {(props) => (
            <Input
              {...props}
              name="cost"
              inputMode="decimal"
              defaultValue={product?.costCents != null ? centsToInput(product.costCents) : ""}
              placeholder="0,00"
            />
          )}
        </Field>
        <Field label="Categoria" optional>
          {(props) => (
            <Input
              {...props}
              name="category"
              defaultValue={product?.category ?? ""}
              placeholder="Ex.: Petiscos"
            />
          )}
        </Field>
        <Field label="Código de barras" optional error={err("barcode")}>
          {(props) => (
            <Input
              {...props}
              name="barcode"
              defaultValue={product?.barcode ?? ""}
              inputMode="numeric"
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-4 rounded-campo border border-rejunte p-4">
        <Switch name="trackStock" checked={track} onChange={setTrack} label="Controlar estoque" />
        {track ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {!product ? (
              <Field label="Quantidade em estoque agora">
                {(props) => (
                  <Input
                    {...props}
                    name="initialStock"
                    type="number"
                    min={0}
                    defaultValue={0}
                    inputMode="numeric"
                  />
                )}
              </Field>
            ) : null}
            <Field label="Avisar quando chegar a" hint="Estoque mínimo.">
              {(props) => (
                <Input
                  {...props}
                  name="minStock"
                  type="number"
                  min={0}
                  defaultValue={product?.minStock ?? 0}
                  inputMode="numeric"
                />
              )}
            </Field>
          </div>
        ) : null}
      </div>
      <div className="border-t border-rejunte pt-5">
        <SubmitButton size="lg" pendingLabel="Salvando…">
          {product ? "Salvar produto" : "Cadastrar produto"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
