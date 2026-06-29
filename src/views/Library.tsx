"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField, SelectField, UploadZone } from "../design-system/components";
import { ContextMenu, useContextMenu } from "../design-system/components/ContextMenu";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useLibraryStore, type LibraryProduct } from "../store/useLibraryStore";
import { useIntegrationsStore } from "../store/useIntegrationsStore";
import { useWizardStore } from "../store/useWizardStore";
import { toast } from "../store/useToastStore";
import type { StockEasyProduct } from "../types/integration";

// StockEasy retorna preços numéricos (ex.: 8.5); a biblioteca guarda strings
// no formato pt-BR usado nos anúncios (ex.: "8,50").
const formatPrice = (value: number) => value.toFixed(2).replace(".", ",");

export const Library: React.FC = () => {
  const { products, refresh, remove, save } = useLibraryStore();
  const { config: integrations, refresh: refreshIntegrations, setStockEasy } = useIntegrationsStore();
  const router = useRouter();
  const [editProduct, setEditProduct] = useState<LibraryProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [syncing, setSyncing] = useState(false);
  // Pending sync waiting on the user to pick which loja to base prices on.
  const [storePicker, setStorePicker] = useState<{ products: LibraryProduct[]; options: string[]; store: string } | null>(null);

  const syncEnabled = integrations.stockeasy.enabled && integrations.stockeasy.hasApiKey;

  useEffect(() => {
    refresh();
    refreshIntegrations();
  }, [refresh, refreshIntegrations]);

  // Writes the chosen loja's price onto the product, keeping every other field.
  const applyPrice = async (p: LibraryProduct, product: StockEasyProduct, store: string) => {
    const entry = product.precos?.find((x) => x.loja === store);
    if (!entry) return `"${p.name}": loja "${store}" sem preço.`;
    await save(
      {
        name: p.name,
        category: p.category,
        reference: p.reference,
        image: p.image,
        priceMode: p.priceMode,
        oldPrice: p.oldPrice,
        newPrice: formatPrice(entry.preco),
        priceSuffix: p.priceSuffix,
        badgeText: p.badgeText,
      },
      p.id,
    );
    return null;
  };

  const syncList = async (list: LibraryProduct[], store: string) => {
    setSyncing(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const p of list) {
        const res = await window.adFrame.stockeasyLookup(p.reference!);
        if (!res.ok) {
          errors.push(`"${p.name}": ${res.error}`);
          continue;
        }
        const err = await applyPrice(p, res.product, store);
        if (err) errors.push(err);
        else ok += 1;
      }
      await refresh();
    } finally {
      setSyncing(false);
    }
    if (ok > 0) toast.success(`${ok} produto(s) sincronizado(s) com a loja "${store}".`);
    if (errors.length) toast.error(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1})` : ""));
  };

  // Ensures a loja is selected (prompting on first sync) before syncing.
  const ensureStoreThenSync = async (targets: LibraryProduct[]) => {
    const withRef = targets.filter((p) => p.reference?.trim());
    if (withRef.length === 0) {
      toast.error("Nenhum produto com referência para sincronizar.");
      return;
    }
    const store = integrations.stockeasy.selectedStore;
    if (store) {
      await syncList(withRef, store);
      return;
    }
    // First sync: look up one product to discover the available lojas.
    setSyncing(true);
    let res;
    try {
      res = await window.adFrame.stockeasyLookup(withRef[0].reference!);
    } finally {
      setSyncing(false);
    }
    if (!res.ok) return toast.error(res.error);
    const options = Array.from(new Set((res.product.precos ?? []).map((x) => x.loja).filter(Boolean)));
    if (options.length === 0) return toast.error("Nenhuma loja disponível na resposta do StockEasy.");
    setStorePicker({ products: withRef, options, store: options[0] });
  };

  const confirmStore = async () => {
    if (!storePicker) return;
    const { products: pending, store } = storePicker;
    setStorePicker(null);
    await setStockEasy({ selectedStore: store });
    await syncList(pending, store);
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ["Todos", ...cats.sort()];
  }, [products]);

  const filtered = useMemo(
    () =>
      activeCategory === "Todos"
        ? products
        : products.filter((p) => p.category === activeCategory),
    [products, activeCategory],
  );

  const addToWizard = (p: LibraryProduct) => {
    const addProduct = useWizardStore.getState().addProduct;
    const updateProduct = useWizardStore.getState().updateProduct;
    addProduct();
    const id = useWizardStore.getState().products.at(-1)!.id;
    updateProduct(id, {
      image: p.image,
      productName: p.name,
      priceMode: p.priceMode,
      oldPrice: p.oldPrice,
      newPrice: p.newPrice,
      priceSuffix: p.priceSuffix,
      badgeText: p.badgeText,
    });
    router.push("/wizard");
    toast.success(`"${p.name}" adicionado ao wizard.`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Biblioteca de Produtos"
        subtitle="Produtos salvos para reutilizar nos seus anúncios."
        actions={
          <div className="flex gap-2">
            {syncEnabled && products.length > 0 && (
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} className={syncing ? "animate-spin" : undefined} />}
                onClick={() => ensureStoreThenSync(products)}
                disabled={syncing}
              >
                {syncing ? "Sincronizando…" : "Sincronizar tudo"}
              </Button>
            )}
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Adicionar produto
            </Button>
          </div>
        }
      />

      {products.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                activeCategory === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="Biblioteca vazia"
          text="Salve produtos aqui para reutilizá-los em múltiplos anúncios."
          action={
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Adicionar produto
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BookOpen size={22} />} title="Nenhum produto nesta categoria" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              canSync={syncEnabled && !!p.reference?.trim()}
              syncing={syncing}
              onSync={() => ensureStoreThenSync([p])}
              onEdit={() => setEditProduct(p)}
              onDelete={async () => {
                await remove(p.id);
                toast.info(`"${p.name}" removido.`);
              }}
              onUse={() => addToWizard(p)}
            />
          ))}
        </div>
      )}

      <ProductFormDialog
        open={addOpen || !!editProduct}
        product={editProduct}
        onClose={() => {
          setAddOpen(false);
          setEditProduct(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditProduct(null);
          refresh();
        }}
      />

      <Dialog
        open={!!storePicker}
        onClose={() => setStorePicker(null)}
        title="Escolha a loja"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStorePicker(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmStore} disabled={!storePicker?.store}>
              Confirmar e sincronizar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Os preços têm valores diferentes por loja. Escolha qual loja servirá de base — essa escolha
            fica salva e é reutilizada nas próximas sincronizações (você pode trocá-la em Configurações).
          </p>
          <Field label="Loja de referência">
            <SelectField
              value={storePicker?.store ?? ""}
              onChange={(e) =>
                setStorePicker((prev) => (prev ? { ...prev, store: e.target.value } : prev))
              }
            >
              {(storePicker?.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
      </Dialog>
    </PageContainer>
  );
};

const ProductCard: React.FC<{
  product: LibraryProduct;
  canSync: boolean;
  syncing: boolean;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
}> = ({ product, canSync, syncing, onSync, onEdit, onDelete, onUse }) => {
  const { menuProps, handleContextMenu, close } = useContextMenu();

  return (
    <>
      <div
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        onContextMenu={handleContextMenu}
      >
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
          {product.image ? (
            <img src={assetUrl(product.image)} alt={product.name} className="size-full object-contain p-2" />
          ) : (
            <span className="text-3xl">📦</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          {product.category && (
            <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {product.category}
            </span>
          )}
          <div className="truncate text-sm font-medium">{product.name}</div>
          {product.reference?.trim() && (
            <span className="truncate text-[10px] text-muted-foreground">Ref: {product.reference}</span>
          )}
          <div className="mt-auto flex items-baseline gap-1.5">
            {product.priceMode === "offer" && product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">R$ {product.oldPrice}</span>
            )}
            <span className="text-sm font-bold text-primary">
              R$ {product.newPrice}
              {product.priceSuffix}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-1 border-t border-border p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="primary" size="sm" className="flex-1" onClick={onUse}>
            Usar
          </Button>
          {canSync && (
            <IconButton label="Sincronizar preço" onClick={onSync} disabled={syncing}>
              <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
            </IconButton>
          )}
          <IconButton label="Editar" onClick={onEdit}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={onDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>

      {menuProps.open && (
        <ContextMenu
          x={menuProps.x}
          y={menuProps.y}
          onClose={close}
          items={[
            { type: "item", label: "Usar no wizard", icon: <Plus size={13} />, onClick: onUse },
            ...(canSync
              ? [{ type: "item" as const, label: "Sincronizar preço", icon: <RefreshCw size={13} />, onClick: onSync }]
              : []),
            { type: "item", label: "Editar", icon: <Pencil size={13} />, onClick: onEdit },
            { type: "separator" },
            { type: "item", label: "Excluir", icon: <Trash2 size={13} />, onClick: onDelete, danger: true },
          ]}
        />
      )}
    </>
  );
};

const CategoryCombobox: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const allProducts = useLibraryStore((s) => s.products);
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const all = Array.from(
      new Set(allProducts.map((p) => p.category).filter(Boolean)),
    ).sort() as string[];
    if (!value.trim()) return all;
    const q = value.toLowerCase();
    return all.filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q);
  }, [allProducts, value]);

  return (
    <div className="relative">
      <TextField
        placeholder="Ex: Laticínios"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {suggestions.map((s) => (
            <li
              key={s}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ProductFormDialog: React.FC<{
  open: boolean;
  product: LibraryProduct | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, product, onClose, onSaved }) => {
  const { save } = useLibraryStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const [image, setImage] = useState("");
  const [priceMode, setPriceMode] = useState<"offer" | "single">("offer");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceSuffix, setPriceSuffix] = useState("");
  const [badgeText, setBadgeText] = useState("Oferta por tempo limitado");

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategory(product.category ?? "");
      setReference(product.reference ?? "");
      setImage(product.image);
      setPriceMode(product.priceMode);
      setOldPrice(product.oldPrice);
      setNewPrice(product.newPrice);
      setPriceSuffix(product.priceSuffix);
      setBadgeText(product.badgeText);
    } else {
      setName("");
      setCategory("");
      setReference("");
      setImage("");
      setPriceMode("offer");
      setOldPrice("");
      setNewPrice("");
      setPriceSuffix("");
      setBadgeText("Oferta por tempo limitado");
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nome do produto é obrigatório.");
    await save(
      { name: name.trim(), category: category.trim(), reference: reference.trim(), image, priceMode, oldPrice, newPrice, priceSuffix, badgeText },
      product?.id,
    );
    toast.success(`"${name.trim()}" salvo na biblioteca.`);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? "Editar produto" : "Adicionar produto"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Imagem do produto">
          <UploadZone value={image} onUpload={setImage} height={120} label="Clique ou arraste a imagem" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do produto">
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arroz Tio João 5kg" />
          </Field>
          <Field label="Categoria">
            <CategoryCombobox value={category} onChange={setCategory} />
          </Field>
        </div>
        <Field
          label="Referência (opcional)"
          hint="Código do produto no seu sistema PDV/ERP — usado para sincronizar o preço via integração."
        >
          <TextField value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex: 201" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Modo de preço">
            <SelectField value={priceMode} onChange={(e) => setPriceMode(e.target.value as "offer" | "single")}>
              <option value="offer">Oferta (preço anterior + novo)</option>
              <option value="single">Preço único</option>
            </SelectField>
          </Field>
          <Field label="Sufixo">
            <TextField value={priceSuffix} onChange={(e) => setPriceSuffix(e.target.value)} placeholder="/kg, /un" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {priceMode === "offer" && (
            <Field label="Preço anterior">
              <TextField value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} placeholder="0,00" />
            </Field>
          )}
          <Field label="Preço">
            <TextField value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0,00" />
          </Field>
        </div>
        <Field label="Texto do badge">
          <TextField value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="Oferta por tempo limitado" />
        </Field>
      </div>
    </Dialog>
  );
};
