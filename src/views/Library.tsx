"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField, SelectField, UploadZone } from "../design-system/components";
import { ContextMenu, useContextMenu } from "../design-system/components/ContextMenu";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useLibraryStore, type LibraryProduct } from "../store/useLibraryStore";
import { useWizardStore } from "../store/useWizardStore";
import { toast } from "../store/useToastStore";

export const Library: React.FC = () => {
  const { products, refresh, remove } = useLibraryStore();
  const router = useRouter();
  const [editProduct, setEditProduct] = useState<LibraryProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Adicionar produto
          </Button>
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
    </PageContainer>
  );
};

const ProductCard: React.FC<{
  product: LibraryProduct;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
}> = ({ product, onEdit, onDelete, onUse }) => {
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
      setImage(product.image);
      setPriceMode(product.priceMode);
      setOldPrice(product.oldPrice);
      setNewPrice(product.newPrice);
      setPriceSuffix(product.priceSuffix);
      setBadgeText(product.badgeText);
    } else {
      setName("");
      setCategory("");
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
      { name: name.trim(), category: category.trim(), image, priceMode, oldPrice, newPrice, priceSuffix, badgeText },
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
