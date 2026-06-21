"use client";

import { useMemo, useState } from "react";
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
import { BookMarked, Check, Clapperboard, Film, GripVertical, Megaphone, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useAdStore } from "../store/useAdStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { Button, Dialog, IconButton, UploadZone } from "../design-system/components";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useLibraryStore, type LibraryProduct } from "../store/useLibraryStore";
import { MediaPickerDialog } from "../components/media/MediaPicker";
import { toast } from "../store/useToastStore";

export const SceneListPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  const seekToScene = useAdStore((s) => s.seekToScene);
  const removeScene = useAdStore((s) => s.removeScene);
  const addProductScene = useAdStore((s) => s.addProductScene);
  const addLogoScene = useAdStore((s) => s.addLogoScene);
  const addTemplateScene = useAdStore((s) => s.addTemplateScene);
  const addVideoScene = useAdStore((s) => s.addVideoScene);
  const setLogoImage = useAdStore((s) => s.setLogoImage);

  const allTemplates = useTemplateStore((s) => s.templates);
  const refreshTemplates = useTemplateStore((s) => s.refresh);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const handleOpenTemplatePicker = async () => {
    await refreshTemplates();
    setTemplatePickerOpen(true);
  };
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

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = config.scenes.map((s) => s.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    reorderScenes(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-card/40 p-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo da empresa</h2>
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

      <section className="flex flex-1 flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cenas</h2>

        <div className="flex flex-col gap-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={config.scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {config.scenes.map((scene) => {
                const isSelected = scene.id === selectedSceneId;
                const label =
                  scene.type === "logo"
                    ? scene.tagline || "Logo / Chamada"
                    : scene.type === "template"
                    ? allTemplates.find((t) => t.id === scene.templateId)?.name || "Template"
                    : scene.type === "video"
                    ? scene.src.split("/").pop() || "Vídeo"
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
            </SortableContext>
          </DndContext>

          {config.scenes.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Adicione cenas abaixo para começar.
            </div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" icon={<ShoppingBag size={14} />} onClick={() => { addProductScene(); toast.success("Cena de produto adicionada."); }}>
            Produto
          </Button>
          <Button variant="secondary" size="sm" icon={<Megaphone size={14} />} onClick={() => { addLogoScene(); toast.success("Cena de logo adicionada."); }}>
            Logo/Texto
          </Button>
          <Button variant="secondary" size="sm" icon={<BookMarked size={14} />} onClick={handleOpenLibrary}>
            Biblioteca
          </Button>
          <Button variant="secondary" size="sm" icon={<Clapperboard size={14} />} onClick={handleOpenTemplatePicker}>
            Template
          </Button>
          <VideoPickerButton
            onPick={(path) => {
              addVideoScene();
              const newScene = useAdStore.getState().config.scenes.at(-1);
              if (newScene && newScene.type === "video") {
                useAdStore.getState().updateScene(newScene.id, { ...newScene, src: path });
              }
              toast.success("Cena de vídeo adicionada.");
            }}
          />
        </div>
      </section>

      {/* Template picker */}
      <Dialog open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} title="Escolher Template" size="xl">
        {allTemplates.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum template encontrado.</div>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {allTemplates.map((tpl) => (
              <button
                key={tpl.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/50"
                onClick={() => {
                  addTemplateScene(tpl.id);
                  setTemplatePickerOpen(false);
                  toast.success(`Template "${tpl.name}" adicionado como cena.`);
                }}
              >
                <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                  <Clapperboard size={28} />
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-sm font-medium">{tpl.name}</span>
                  <span className="text-xs text-muted-foreground">{tpl.scenes.length} cenas</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Dialog>

      {/* Library import */}
      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Importar da Biblioteca"
        size="xl"
        footer={
          selected.length > 0 ? (
            <>
              <span className="mr-auto text-sm text-muted-foreground">
                {selected.length} produto{selected.length > 1 ? "s" : ""} selecionado{selected.length > 1 ? "s" : ""}
              </span>
              <Button variant="secondary" onClick={() => setSelected([])}>
                Limpar
              </Button>
              <Button variant="primary" onClick={handleImport}>
                Importar {selected.length} {selected.length > 1 ? "cenas" : "cena"}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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

          {library.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum produto salvo na biblioteca ainda.</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((product) => {
                const idx = selected.indexOf(product.id);
                const isSelected = idx !== -1;
                return (
                  <button
                    key={product.id}
                    className={cn(
                      "relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors",
                      isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
                    )}
                    onClick={() => toggleSelect(product.id)}
                  >
                    {isSelected && (
                      <div className="absolute left-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {idx + 1}
                      </div>
                    )}
                    <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                      {product.image ? (
                        <img src={assetUrl(product.image)} alt={product.name} className="size-full object-contain p-1" />
                      ) : (
                        <ShoppingBag size={22} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-2">
                      {product.category && (
                        <span className="w-fit rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">{product.category}</span>
                      )}
                      <span className="truncate text-xs font-medium">{product.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {product.priceMode === "offer"
                          ? `R$ ${product.oldPrice} → R$ ${product.newPrice}`
                          : `R$ ${product.newPrice}`}
                        {product.priceSuffix && ` ${product.priceSuffix}`}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={11} />
                      </div>
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

const VideoPickerButton: React.FC<{ onPick: (path: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Film size={14} />} onClick={() => setOpen(true)}>
        Vídeo
      </Button>
      <MediaPickerDialog
        open={open}
        accept="video"
        currentValue=""
        onSelect={(path) => {
          onPick(path);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

const SortableSceneChip: React.FC<{
  id: string;
  label: string;
  type: "logo" | "product" | "template" | "video";
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}> = ({ id, label, type, isSelected, onSelect, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const Icon = type === "logo" ? Megaphone : type === "template" ? Clapperboard : type === "video" ? Film : ShoppingBag;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors",
        isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/40",
      )}
      onClick={onSelect}
    >
      <span
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </span>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
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
    </div>
  );
};
