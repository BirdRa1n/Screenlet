import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookMarked, Check, GripVertical, Megaphone, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useAdStore } from "../store/useAdStore";
import { Button, Dialog, IconButton, UploadZone } from "../design-system/components";
import { useLibraryStore, type LibraryProduct } from "../store/useLibraryStore";
import { toast } from "../store/useToastStore";
import "../styles/layout/SceneListPanel.css";

export const SceneListPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  const selectScene = useAdStore((s) => s.selectScene);
  const seekToScene = useAdStore((s) => s.seekToScene);
  const removeScene = useAdStore((s) => s.removeScene);
  const addProductScene = useAdStore((s) => s.addProductScene);
  const addLogoScene = useAdStore((s) => s.addLogoScene);
  const setLogoImage = useAdStore((s) => s.setLogoImage);
  const reorderScenes = useAdStore((s) => s.reorderScenes);
  const updateScene = useAdStore((s) => s.updateScene);

  const library = useLibraryStore((s) => s.products);
  const refreshLibrary = useLibraryStore((s) => s.refresh);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [selected, setSelected] = useState<string[]>([]);

  const handleOpenLibrary = async () => {
    await refreshLibrary();
    setSearch("");
    setActiveCategory("Todos");
    setSelected([]);
    setLibraryOpen(true);
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(library.map((p) => p.category).filter(Boolean)));
    return ["Todos", ...cats.sort()];
  }, [library]);

  const filtered = useMemo(() => {
    let list = activeCategory === "Todos" ? library : library.filter((p) => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    return list;
  }, [library, activeCategory, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImport = () => {
    const toImport = selected
      .map((id) => library.find((p) => p.id === id))
      .filter(Boolean) as LibraryProduct[];

    toImport.forEach((product) => {
      addProductScene();
      const newScene = useAdStore.getState().config.scenes.at(-1);
      if (newScene && newScene.type === "product") {
        updateScene(newScene.id, {
          ...newScene,
          image: product.image,
          productName: product.name,
          priceMode: product.priceMode,
          oldPrice: product.oldPrice,
          newPrice: product.newPrice,
          priceSuffix: product.priceSuffix,
          badgeText: product.badgeText,
        });
      }
    });
    setLibraryOpen(false);
    toast.success(`${toImport.length} produto${toImport.length > 1 ? "s" : ""} importado${toImport.length > 1 ? "s" : ""} como cenas.`);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = config.scenes.map((s) => s.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    reorderScenes(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <aside className="vt-panel vt-panel--left">
      <section className="vt-panel__section">
        <h2 className="vt-panel__title">Logo da empresa</h2>
        <UploadZone
          value={config.logoImage}
          onUpload={(path) => {
            setLogoImage(path);
            toast.success("Logo atualizada com sucesso.");
          }}
          label="Clique ou arraste a logo"
          hint="PNG ou SVG transparente"
          height={96}
          previewFit="contain"
        />
      </section>

      <section className="vt-panel__section vt-panel__section--grow">
        <h2 className="vt-panel__title">Cenas</h2>

        <div className="vt-scene-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={config.scenes.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence initial={false}>
                {config.scenes.map((scene) => {
                  const isSelected = scene.id === selectedSceneId;
                  const label =
                    scene.type === "logo"
                      ? scene.tagline || "Logo / Chamada"
                      : scene.productName || "Produto";

                  return (
                    <SortableSceneChip
                      key={scene.id}
                      id={scene.id}
                      label={label}
                      type={scene.type}
                      isSelected={isSelected}
                      onSelect={() => seekToScene(scene.id)}
                      onRemove={() => {
                        removeScene(scene.id);
                        toast.info("Cena removida.");
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </SortableContext>
          </DndContext>

          {config.scenes.length === 0 && (
            <div className="vt-scene-list__empty">
              Adicione cenas abaixo para começar.
            </div>
          )}
        </div>

        <div className="vt-panel__add-row">
          <Button
            variant="secondary"
            size="sm"
            icon={<ShoppingBag size={14} />}
            onClick={() => {
              addProductScene();
              toast.success("Cena de produto adicionada.");
            }}
          >
            Produto
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Megaphone size={14} />}
            onClick={() => {
              addLogoScene();
              toast.success("Cena de logo adicionada.");
            }}
          >
            Logo/Texto
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<BookMarked size={14} />}
            onClick={handleOpenLibrary}
          >
            Biblioteca
          </Button>
        </div>
      </section>

      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Importar da Biblioteca"
        size="xl"
        footer={
          selected.length > 0 ? (
            <>
              <span className="vt-lib-picker__count">
                {selected.length} produto{selected.length > 1 ? "s" : ""} selecionado{selected.length > 1 ? "s" : ""}
              </span>
              <Button variant="secondary" onClick={() => setSelected([])}>Limpar</Button>
              <Button variant="primary" onClick={handleImport}>
                Importar {selected.length} {selected.length > 1 ? "cenas" : "cena"}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="vt-lib-picker">
          {/* Search */}
          <div className="vt-lib-picker__search-wrap">
            <Search size={14} className="vt-lib-picker__search-icon" />
            <input
              className="vt-lib-picker__search"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category pills */}
          {categories.length > 1 && (
            <div className="vt-lib-picker__cats">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`vt-lib-picker__cat${activeCategory === cat ? " vt-lib-picker__cat--active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {library.length === 0 ? (
            <div className="vt-lib-picker__empty">
              Nenhum produto salvo na biblioteca ainda.
            </div>
          ) : filtered.length === 0 ? (
            <div className="vt-lib-picker__empty">Nenhum resultado encontrado.</div>
          ) : (
            <div className="vt-lib-picker__grid">
              {filtered.map((product) => {
                const idx = selected.indexOf(product.id);
                const isSelected = idx !== -1;
                return (
                  <button
                    key={product.id}
                    className={`vt-lib-picker__card${isSelected ? " vt-lib-picker__card--selected" : ""}`}
                    onClick={() => toggleSelect(product.id)}
                  >
                    {isSelected && (
                      <div className="vt-lib-picker__badge">{idx + 1}</div>
                    )}
                    <div className="vt-lib-picker__img">
                      {product.image ? (
                        <img src={product.image} alt={product.name} />
                      ) : (
                        <ShoppingBag size={22} />
                      )}
                    </div>
                    <div className="vt-lib-picker__info">
                      {product.category && (
                        <span className="vt-lib-picker__cat-tag">{product.category}</span>
                      )}
                      <span className="vt-lib-picker__name">{product.name}</span>
                      <span className="vt-lib-picker__price">
                        {product.priceMode === "offer"
                          ? `R$ ${product.oldPrice} → R$ ${product.newPrice}`
                          : `R$ ${product.newPrice}`}
                        {product.priceSuffix && ` ${product.priceSuffix}`}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="vt-lib-picker__check"><Check size={11} /></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </aside>
  );
};

const SortableSceneChip: React.FC<{
  id: string;
  label: string;
  type: "logo" | "product";
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}> = ({ id, label, type, isSelected, onSelect, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" as const }}
      className={`vt-scene-chip${isSelected ? " vt-scene-chip--selected" : ""}`}
      onClick={onSelect}
    >
      <span
        className="vt-scene-chip__drag"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </span>

      <span className="vt-scene-chip__icon">
        {type === "logo" ? <Megaphone size={14} /> : <ShoppingBag size={14} />}
      </span>

      <span className="vt-scene-chip__label">{label}</span>

      <span className="vt-scene-chip__actions">
        <IconButton
          label="Remover cena"
          variant="danger"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={13} />
        </IconButton>
      </span>
    </motion.div>
  );
};
