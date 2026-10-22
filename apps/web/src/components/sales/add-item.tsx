"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { formatBRL, SIZES, type Size } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import type { BookableService } from "@/lib/agenda";
import { addOrderItemAction } from "@/server/sales-actions";

export interface SellableProduct {
  id: string;
  name: string;
  priceCents: number;
  stockQuantity: number;
  trackStock: boolean;
}

type Kind = "servico" | "produto" | "avulso";

export function AddItem({
  orderId,
  services,
  products,
  staff,
}: {
  orderId: string;
  services: BookableService[];
  products: SellableProduct[];
  staff: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Adicionar item
      </Button>
      {open ? (
        <Sheet open onOpenChange={setOpen} title="Adicionar item">
          <AddItemForm
            orderId={orderId}
            services={services}
            products={products}
            staff={staff}
            onDone={() => setOpen(false)}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function AddItemForm({
  orderId,
  services,
  products,
  staff,
  onDone,
}: {
  orderId: string;
  services: BookableService[];
  products: SellableProduct[];
  staff: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(addOrderItemAction, null);
  const [kind, setKind] = useState<Kind>(products.length > 0 ? "produto" : "servico");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [size, setSize] = useState<Size>("P");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const service = services.find((s) => s.id === serviceId);
  const product = products.find((p) => p.id === productId);

  return (
    <ActionForm action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <ChoiceCards
        name="kind"
        value={kind}
        onChange={setKind}
        columns={3}
        options={[
          { value: "produto", label: "Produto" },
          { value: "servico", label: "Serviço" },
          { value: "avulso", label: "Outro" },
        ]}
      />
      {kind === "servico" ? (
        services.length === 0 ? (
          <p className="text-tinta-suave">Nenhum serviço cadastrado.</p>
        ) : (
          <>
            <Field label="Serviço">
              {(props) => (
                <Select
                  {...props}
                  name="serviceId"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <ChoiceCards
              name="size"
              legend="Porte"
              value={size}
              onChange={setSize}
              columns={4}
              options={SIZES.map((value) => ({
                value,
                label: value,
                description: service?.prices[value]
                  ? formatBRL(service.prices[value]!.priceCents)
                  : "sem preço",
              }))}
            />
            {staff.length > 1 ? (
              <Field label="Quem fez" optional hint="Usado na comissão.">
                {(props) => (
                  <Select {...props} name="performedBy" defaultValue="">
                    <option value="">Ninguém em especial</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
          </>
        )
      ) : null}
      {kind === "produto" ? (
        products.length === 0 ? (
          <p className="text-tinta-suave">
            Nenhum produto cadastrado. Cadastre em Produtos e estoque.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field
              label="Produto"
              hint={
                product
                  ? `${formatBRL(product.priceCents)}${product.trackStock ? ` · ${product.stockQuantity} em estoque` : ""}`
                  : undefined
              }
            >
              {(props) => (
                <Select
                  {...props}
                  name="productId"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Quantidade">
              {(props) => (
                <Input
                  {...props}
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  inputMode="numeric"
                />
              )}
            </Field>
          </div>
        )
      ) : null}
      {kind === "avulso" ? (
        <>
          <Field label="Descrição" error={fieldError(state, "description")}>
            {(props) => (
              <Input
                {...props}
                name="description"
                placeholder="Ex.: Taxa de leva e traz"
                maxLength={80}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-5 sm:max-w-sm">
            <Field label="Valor (R$)">
              {(props) => <Input {...props} name="price" inputMode="decimal" placeholder="0,00" />}
            </Field>
            <Field label="Quantidade">
              {(props) => (
                <Input
                  {...props}
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  inputMode="numeric"
                />
              )}
            </Field>
          </div>
        </>
      ) : null}
      <div className="border-t border-rejunte pt-5">
        <SubmitButton size="lg" pendingLabel="Incluindo…">
          Incluir na comanda
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
