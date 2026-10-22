"use client";

import { useState } from "react";
import {
  describeSizeRange,
  SIZE_LABELS,
  SIZES,
  sizeForWeight,
  type Size,
  type SizeRanges,
} from "@petshop/core";
import { fieldError } from "@/components/action-feedback";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { COAT_LABELS, SEX_LABELS, SPECIES_LABELS } from "@/lib/pets";

export interface PetValues {
  name: string;
  species: "cao" | "gato" | "outro";
  breed: string;
  sex: string;
  birthDate: string;
  weightKg: string;
  size: Size | "";
  coat: string;
  neutered: string;
  color: string;
  temperament: string;
  allergies: string;
  restrictions: string;
  notes: string;
  bathFrequencyDays: string;
}

export const EMPTY_PET: PetValues = {
  name: "",
  species: "cao",
  breed: "",
  sex: "",
  birthDate: "",
  weightKg: "",
  size: "",
  coat: "",
  neutered: "",
  color: "",
  temperament: "",
  allergies: "",
  restrictions: "",
  notes: "",
  bathFrequencyDays: "",
};

/** Campos do pet (nomes com prefixo "pet."). O porte é sugerido pelo peso e pode ser trocado. */
export function PetFields({
  values,
  sizeRanges,
  state,
  compact = false,
}: {
  values: PetValues;
  sizeRanges: SizeRanges;
  state: ActionResult<unknown> | null;
  /** Só o essencial (cadastro rápido); o resto fica num "mais detalhes". */
  compact?: boolean;
}) {
  const [species, setSpecies] = useState(values.species);
  const [weight, setWeight] = useState(values.weightKg);
  const [size, setSize] = useState<Size | "">(values.size);
  const [sizeTouched, setSizeTouched] = useState(Boolean(values.size));
  const weightNumber = Number(weight.replace(",", "."));
  const suggested = weight && weightNumber > 0 ? sizeForWeight(weightNumber, sizeRanges) : null;
  const shownSize = sizeTouched ? size : (suggested ?? size);
  const err = (name: string) => fieldError(state, `pet.${name}`);

  const details = (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Sexo" optional>
          {(props) => (
            <Select {...props} name="pet.sex" defaultValue={values.sex}>
              <option value="">Não informado</option>
              {Object.entries(SEX_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nascimento" optional>
          {(props) => (
            <Input {...props} name="pet.birthDate" type="date" defaultValue={values.birthDate} />
          )}
        </Field>
        <Field label="Castrado" optional>
          {(props) => (
            <Select {...props} name="pet.neutered" defaultValue={values.neutered}>
              <option value="">Não informado</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Pelagem" optional>
          {(props) => (
            <Select {...props} name="pet.coat" defaultValue={values.coat}>
              <option value="">Não informada</option>
              {Object.entries(COAT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cor" optional>
          {(props) => <Input {...props} name="pet.color" defaultValue={values.color} />}
        </Field>
        <Field label="Banho a cada" optional hint="Em dias. Usado nos lembretes.">
          {(props) => (
            <Input
              {...props}
              name="pet.bathFrequencyDays"
              inputMode="numeric"
              placeholder="15"
              defaultValue={values.bathFrequencyDays}
            />
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-4 rounded-campo border border-patinho/50 bg-patinho-claro/40 p-4">
        <legend className="px-1 font-medium">Alertas para a equipe</legend>
        <p className="-mt-2 text-sm text-tinta-suave">
          Aparecem em destaque na agenda e no atendimento.
        </p>
        <Field label="Comportamento" optional error={err("temperament")}>
          {(props) => (
            <Input
              {...props}
              name="pet.temperament"
              placeholder="Ex.: morde ao cortar as unhas, ansioso com secador"
              defaultValue={values.temperament}
            />
          )}
        </Field>
        <Field label="Alergias" optional error={err("allergies")}>
          {(props) => <Input {...props} name="pet.allergies" defaultValue={values.allergies} />}
        </Field>
        <Field label="Restrições e cuidados" optional error={err("restrictions")}>
          {(props) => (
            <Input
              {...props}
              name="pet.restrictions"
              placeholder="Ex.: só shampoo hipoalergênico, não usar secador"
              defaultValue={values.restrictions}
            />
          )}
        </Field>
      </fieldset>
      <Field label="Observações" optional>
        {(props) => <Textarea {...props} name="pet.notes" rows={2} defaultValue={values.notes} />}
      </Field>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome do pet" error={err("name")}>
          {(props) => (
            <Input {...props} name="pet.name" defaultValue={values.name} autoComplete="off" />
          )}
        </Field>
        <Field label="Raça" optional>
          {(props) => (
            <Input
              {...props}
              name="pet.breed"
              defaultValue={values.breed}
              placeholder="Ex.: Shih-tzu, SRD"
            />
          )}
        </Field>
      </div>
      <ChoiceCards
        name="pet.species"
        legend="Espécie"
        columns={3}
        value={species}
        onChange={setSpecies}
        options={Object.entries(SPECIES_LABELS).map(([value, label]) => ({
          value: value as PetValues["species"],
          label,
        }))}
      />
      <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Field label="Peso (kg)" optional error={err("weightKg")}>
          {(props) => (
            <Input
              {...props}
              name="pet.weightKg"
              inputMode="decimal"
              placeholder="8,5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <ChoiceCards
            name="pet.size"
            legend="Porte"
            columns={4}
            value={shownSize || null}
            onChange={(value) => {
              setSizeTouched(true);
              setSize(value);
            }}
            options={SIZES.map((value) => ({
              value,
              label: `${SIZE_LABELS[value]}`,
              description: describeSizeRange(value, sizeRanges),
            }))}
          />
          {suggested && !sizeTouched ? (
            <p className="text-sm text-tinta-suave">
              Porte sugerido pelo peso. Toque em outro se precisar.
            </p>
          ) : null}
          {err("size") ? <p className="text-sm font-medium text-alerta">{err("size")}</p> : null}
        </div>
      </div>
      {compact ? (
        <details className="rounded-campo border border-rejunte">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-medium">
            Mais detalhes e alertas (opcional)
          </summary>
          <div className="border-t border-rejunte p-4">{details}</div>
        </details>
      ) : (
        details
      )}
    </div>
  );
}
