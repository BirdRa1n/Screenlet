import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField, UploadZone } from "../design-system/components";
import { ContextMenu, useContextMenu } from "../design-system/components/ContextMenu";
import { useLibraryStore, type LibraryProduct } from "../store/useLibraryStore";
import { useNavigationStore } from "../store/useNavigationStore";
import { useWizardStore } from "../store/useWizardStore";
import { toast } from "../store/useToastStore";
import "../styles/pages/Library.css";

export const Library: React.FC = () => {
  const { products, refresh, remove } = useLibraryStore();
  const navigate = useNavigationStore((s) => s.navigate);
  const [editProduct, setEditProduct] = useState<LibraryProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  useEffect(() => { refresh(); }, [refresh]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ["Todos", ...cats.sort()];
  }, [products]);

  const filtered = useMemo(() =>
    activeCategory === "Todos" ? products : products.filter((p) => p.category === activeCategory),
    [products, activeCategory]
  );

  return (
    <div className="vt-library">
      <div className="vt-library__header">
        <div>
          <h1 className="vt-library__title">Biblioteca de Produtos</h1>
          <p className="vt-library__sub">Produtos salvos para reutilizar nos seus anúncios.</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
          Adicionar produto
        </Button>
      </div>

      {products.length > 0 && (
        <div className="vt-library__cats">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`vt-library__cat-pill${activeCategory === cat ? " vt-library__cat-pill--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="vt-library__grid">
        {products.length === 0 ? (
          <div className="vt-library__empty">
            <div className="vt-library__empty-icon"><BookOpen size={22} /></div>
            <p className="vt-library__empty-title">Biblioteca vazia</p>
            <p className="vt-library__empty-text">
              Salve produtos aqui para reutilizá-los em múltiplos anúncios.
            </p>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Adicionar produto
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="vt-library__empty">
            <p className="vt-library__empty-title">Nenhum produto nesta categoria</p>
          </div>
        ) : (
          filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => setEditProduct(p)}
              onDelete={async () => { await remove(p.id); toast.info(`"${p.name}" removido.`); }}
              onUse={() => {
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
                navigate("wizard");
                toast.success(`"${p.name}" adicionado ao wizard.`);
              }}
            />
          ))
        )}
      </div>

      <ProductFormDialog
        open={addOpen || !!editProduct}
        product={editProduct}
        onClose={() => { setAddOpen(false); setEditProduct(null); }}
        onSaved={() => { setAddOpen(false); setEditProduct(null); refresh(); }}
      />
    </div>
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
      <motion.div
        className="vt-lib-card"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        onContextMenu={handleContextMenu}
      >
        <div className="vt-lib-card__image">
          {product.image ? (
            <img src={product.image} alt={product.name} className="vt-lib-card__img" />
          ) : (
            <div className="vt-lib-card__img-placeholder">📦</div>
          )}
        </div>
        <div className="vt-lib-card__body">
          {product.category && (
            <span className="vt-lib-card__cat">{product.category}</span>
          )}
          <div className="vt-lib-card__name">{product.name}</div>
          <div className="vt-lib-card__price">
            {product.priceMode === "offer" && product.oldPrice && (
              <span className="vt-lib-card__price-old">R$ {product.oldPrice}</span>
            )}
            <span className="vt-lib-card__price-new">R$ {product.newPrice}{product.priceSuffix}</span>
          </div>
        </div>
        <div className="vt-lib-card__actions" onClick={(e) => e.stopPropagation()}>
          <Button variant="primary" size="sm" onClick={onUse}>Usar</Button>
          <IconButton label="Editar" onClick={onEdit}><Pencil size={13} /></IconButton>
          <IconButton label="Excluir" variant="danger" onClick={onDelete}><Trash2 size={13} /></IconButton>
        </div>
      </motion.div>

      <AnimatePresence>
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
      </AnimatePresence>
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
    const all = Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean))).sort() as string[];
    if (!value.trim()) return all;
    const q = value.toLowerCase();
    return all.filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q);
  }, [allProducts, value]);

  return (
    <div className="vt-lib-catbox">
      <input
        className="ds-input"
        placeholder="Ex: Laticínios"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 && (
        <ul className="vt-lib-catbox__list">
          {suggestions.map((s) => (
            <li key={s} className="vt-lib-catbox__item" onMouseDown={() => { onChange(s); setOpen(false); }}>
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
      setName(product.name); setCategory(product.category ?? ""); setImage(product.image);
      setPriceMode(product.priceMode); setOldPrice(product.oldPrice); setNewPrice(product.newPrice);
      setPriceSuffix(product.priceSuffix); setBadgeText(product.badgeText);
    } else {
      setName(""); setCategory(""); setImage(""); setPriceMode("offer");
      setOldPrice(""); setNewPrice(""); setPriceSuffix(""); setBadgeText("Oferta por tempo limitado");
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nome do produto é obrigatório.");
    await save(
      { name: name.trim(), category: category.trim(), image, priceMode, oldPrice, newPrice, priceSuffix, badgeText },
      product?.id
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
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div className="vt-lib-form">
        <Field label="Imagem do produto">
          <UploadZone value={image} onUpload={setImage} height={120} label="Clique ou arraste a imagem" />
        </Field>
        <div className="vt-lib-form__row">
          <Field label="Nome do produto">
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arroz Tio João 5kg" />
          </Field>
          <Field label="Categoria">
            <CategoryCombobox value={category} onChange={setCategory} />
          </Field>
        </div>
        <div className="vt-lib-form__row">
          <Field label="Modo de preço">
            <select className="ds-select" value={priceMode} onChange={(e) => setPriceMode(e.target.value as "offer" | "single")}>
              <option value="offer">Oferta (preço anterior + novo)</option>
              <option value="single">Preço único</option>
            </select>
          </Field>
          <Field label="Sufixo">
            <TextField value={priceSuffix} onChange={(e) => setPriceSuffix(e.target.value)} placeholder="/kg, /un" />
          </Field>
        </div>
        <div className="vt-lib-form__row">
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
