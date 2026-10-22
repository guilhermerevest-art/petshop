import QRCode from "qrcode";
import { buildPixPayload, formatBRL, PIX_KEY_TYPE_LABELS, type PixKeyType } from "@petshop/core";
import { CopyButton } from "@/components/ui/copy-button";
import { Panel, PanelSection } from "@/components/ui/panel";

const TEST_AMOUNT = 100;

/** QR Code de R$ 1,00 para o dono conferir no app do banco se nome e cidade aparecem certos. */
export async function PixTest({
  pix,
}: {
  pix: { keyType: PixKeyType; key: string; merchantName: string; merchantCity: string };
}) {
  const payload = buildPixPayload({
    key: pix.key,
    merchantName: pix.merchantName,
    merchantCity: pix.merchantCity,
    amountCents: TEST_AMOUNT,
    txid: "TESTE",
  });
  const qr = await QRCode.toDataURL(payload, {
    margin: 1,
    width: 240,
    color: { dark: "#10293a", light: "#ffffff" },
  });

  return (
    <Panel>
      <PanelSection className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center">
        <div>
          <h2 className="text-lg">Teste antes de usar com clientes</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[15px]">
            <li>Abra o app de qualquer banco e escolha pagar com PIX lendo QR Code.</li>
            <li>Aponte para o código ao lado ({formatBRL(TEST_AMOUNT)}).</li>
            <li>
              Confira se aparecem <strong className="font-medium">{pix.merchantName}</strong> e{" "}
              <strong className="font-medium">{pix.merchantCity}</strong>.
            </li>
            <li>Não precisa concluir o pagamento.</li>
          </ol>
          <p className="mt-4 text-sm text-tinta-suave">
            Chave {PIX_KEY_TYPE_LABELS[pix.keyType]}: {pix.key}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR Code PIX de teste de ${formatBRL(TEST_AMOUNT)}`}
          width={240}
          height={240}
          className="mx-auto rounded-campo border border-rejunte"
        />
      </PanelSection>
      <PanelSection className="flex flex-col gap-3">
        <p className="text-sm text-tinta-suave">Ou use o PIX copia e cola:</p>
        <code className="block rounded-campo bg-espuma px-3 py-2 text-xs break-all">{payload}</code>
        <div>
          <CopyButton value={payload} label="Copiar código" />
        </div>
      </PanelSection>
    </Panel>
  );
}
