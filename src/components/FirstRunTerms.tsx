"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button, Dialog, Checkbox } from "@/design-system/components";
import { useAppSettingsStore } from "@/store/useAppSettingsStore";

const TERMS_URL = "https://screenlet.birdra1n.com/termos";

/**
 * Shown once, on the very first launch: directs the user to read the Terms of
 * Service in their default browser before using the app. Acknowledgement is
 * persisted (app-settings.json) so it never appears again. Non-dismissible —
 * the user must open/read and confirm.
 */
export function FirstRunTerms() {
  const settings = useAppSettingsStore((s) => s.settings);
  const loaded = useAppSettingsStore((s) => s.loaded);
  const refresh = useAppSettingsStore((s) => s.refresh);
  const acknowledgeTerms = useAppSettingsStore((s) => s.acknowledgeTerms);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Guard: in a pure-browser dev run there's no Electron bridge to read from.
    if (typeof window !== "undefined" && window.adFrame) refresh();
  }, [refresh]);

  const open = loaded && !settings.termsAcknowledged;
  if (!open) return null;

  const openTerms = () => window.adFrame?.openExternal(TERMS_URL);

  const accept = async () => {
    setSaving(true);
    try {
      await acknowledgeTerms();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => {}}
      showCloseButton={false}
      title="Bem-vindo ao Screenlet"
      footer={
        <>
          <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={openTerms}>
            Ler no navegador
          </Button>
          <Button variant="primary" onClick={accept} disabled={!agreed || saving}>
            {saving ? "Salvando…" : "Concordar e continuar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Antes de começar, leia os <strong className="text-foreground">Termos de Serviço</strong>.
          Eles explicam, de forma resumida:
        </p>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            uso livre para pessoas físicas e empresas de até 3 pessoas;
          </li>
          <li className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            o conteúdo que você cria e transmite é de sua responsabilidade;
          </li>
          <li className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            não coletamos nenhuma informação sua nem da sua máquina.
          </li>
        </ul>

        <button
          onClick={openTerms}
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Abrir os Termos de Serviço</span>
            <span className="block truncate text-xs text-muted-foreground">screenlet.birdra1n.com/termos</span>
          </span>
          <ExternalLink size={14} className="shrink-0 text-muted-foreground" />
        </button>

        <Checkbox
          checked={agreed}
          onChange={setAgreed}
          label="Li e concordo com os Termos de Serviço."
        />
      </div>
    </Dialog>
  );
}
