"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  FolderOpen,
  FolderSearch,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Checkbox, Dialog } from "../design-system/components";
import { toast } from "../store/useToastStore";
import type { BackupCategory, BackupEntry } from "../global";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type ImportTarget = { path: string; filename: string; categories: string[] };

export function BackupSettings() {
  const [categories, setCategories] = useState<BackupCategory[]>([]);
  const [dir, setDir] = useState("");
  const [list, setList] = useState<BackupEntry[]>([]);
  const [exportSel, setExportSel] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [importSel, setImportSel] = useState<Record<string, boolean>>({});
  const [restoring, setRestoring] = useState(false);

  const labelOf = useMemo(() => {
    const map = new Map(categories.map((c) => [c.key, c.label]));
    return (key: string) => map.get(key) ?? key;
  }, [categories]);

  const refreshList = async () => setList(await window.adFrame.backupList());

  useEffect(() => {
    if (!window.adFrame) return;
    (async () => {
      const [cats, backupDir, entries] = await Promise.all([
        window.adFrame.backupCategories(),
        window.adFrame.backupGetDir(),
        window.adFrame.backupList(),
      ]);
      setCategories(cats);
      setDir(backupDir);
      setList(entries);
      setExportSel(Object.fromEntries(cats.map((c) => [c.key, true])));
    })();
  }, []);

  const exportKeys = categories.map((c) => c.key).filter((k) => exportSel[k]);

  const handleCreate = async () => {
    if (exportKeys.length === 0) return toast.error("Selecione ao menos uma categoria.");
    setCreating(true);
    try {
      const res = await window.adFrame.backupCreate(exportKeys);
      if (res.ok) {
        toast.success("Backup criado.");
        await refreshList();
      } else {
        toast.error(`Erro ao criar backup: ${res.error}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleChooseDir = async () => {
    const chosen = await window.adFrame.backupChooseDir();
    setDir(chosen);
    await refreshList();
  };

  const handleDelete = async (entry: BackupEntry) => {
    await window.adFrame.backupDelete(entry.filename);
    await refreshList();
    toast.info("Backup removido.");
  };

  const openImport = (categoriesInBackup: string[], target: ImportTarget) => {
    if (categoriesInBackup.length === 0) {
      toast.error("Este backup não contém categorias legíveis.");
      return;
    }
    setImportTarget(target);
    setImportSel(Object.fromEntries(categoriesInBackup.map((k) => [k, true])));
  };

  const handleImportEntry = (entry: BackupEntry) => {
    openImport(entry.categories ?? [], {
      path: entry.path,
      filename: entry.filename,
      categories: entry.categories ?? [],
    });
  };

  const handleImportFile = async () => {
    const picked = await window.adFrame.backupPick();
    if (!picked) return;
    if (!picked.ok) return toast.error(picked.error);
    openImport(picked.categories, {
      path: picked.path,
      filename: picked.filename,
      categories: picked.categories,
    });
  };

  const importKeys = importTarget ? importTarget.categories.filter((k) => importSel[k]) : [];

  const handleRestore = async () => {
    if (!importTarget) return;
    if (importKeys.length === 0) return toast.error("Selecione ao menos uma categoria.");
    setRestoring(true);
    const res = await window.adFrame.backupRestore({ path: importTarget.path, categories: importKeys });
    if (res.ok) {
      toast.success("Importado! Reiniciando o app…");
      // The app relaunches from the main process; nothing else to do here.
    } else {
      setRestoring(false);
      toast.error(`Erro ao importar: ${res.error ?? "desconhecido"}`);
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold">Backup e restauração</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere backups selecionando o que incluir e restaure quando precisar — útil para migrar de
          computador. A restauração reinicia o app ao concluir.
        </p>
      </div>

      {/* Backup folder */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Pasta dos backups</span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <FolderOpen size={15} className="shrink-0 text-muted-foreground" />
          <span className="truncate text-sm" title={dir}>{dir || "—"}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FolderSearch size={13} />} onClick={handleChooseDir}>
            Alterar pasta
          </Button>
          <Button variant="secondary" size="sm" icon={<FolderOpen size={13} />} onClick={() => window.adFrame.backupOpenDir()}>
            Abrir no Finder
          </Button>
        </div>
      </div>

      {/* Create backup */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-xs font-medium text-muted-foreground">Criar backup — selecione o que incluir</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <Checkbox
              key={c.key}
              checked={!!exportSel[c.key]}
              onChange={(v) => setExportSel((s) => ({ ...s, [c.key]: v }))}
              label={c.label}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground/80">
          As credenciais de dispositivos e integrações são criptografadas e vinculadas a este
          computador — ao restaurar em outra máquina, elas precisarão ser inseridas novamente.
        </p>
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={13} />}
          onClick={handleCreate}
          disabled={creating || exportKeys.length === 0}
          className="w-fit"
        >
          {creating ? "Criando…" : "Criar backup"}
        </Button>
      </div>

      {/* Saved backups */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Backups salvos</span>
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={handleImportFile}>
            Importar de um arquivo…
          </Button>
        </div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-3 py-8 text-center">
            <Archive size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nenhum backup ainda.</span>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {list.map((entry) => (
              <li key={entry.filename} className="flex items-center gap-3 px-3 py-2.5">
                <Archive size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{formatDate(entry.createdAt)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatBytes(entry.size)}
                    {entry.categories ? ` · ${entry.categories.map(labelOf).join(", ")}` : ""}
                  </div>
                </div>
                <Button variant="secondary" size="sm" icon={<Upload size={12} />} onClick={() => handleImportEntry(entry)}>
                  Importar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.adFrame.backupReveal(entry.filename)}>
                  Revelar
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleDelete(entry)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Import dialog */}
      <Dialog
        open={!!importTarget}
        onClose={() => !restoring && setImportTarget(null)}
        title="Importar backup"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportTarget(null)} disabled={restoring}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleRestore} disabled={restoring || importKeys.length === 0}>
              {restoring ? "Importando…" : "Importar e reiniciar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            De <span className="font-medium text-foreground">{importTarget?.filename}</span>. Selecione o que
            restaurar — os dados atuais dessas categorias serão substituídos. O app será reiniciado ao concluir.
          </p>
          <div className="flex flex-col gap-2">
            {(importTarget?.categories ?? []).map((key) => (
              <Checkbox
                key={key}
                checked={!!importSel[key]}
                onChange={(v) => setImportSel((s) => ({ ...s, [key]: v }))}
                label={labelOf(key)}
              />
            ))}
          </div>
        </div>
      </Dialog>
    </section>
  );
}
