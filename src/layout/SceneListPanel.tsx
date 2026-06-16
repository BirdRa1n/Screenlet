import React from "react";
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
import { GripVertical, Megaphone, ShoppingBag, Trash2 } from "lucide-react";
import { useAdStore } from "../store/useAdStore";
import { Button, IconButton, UploadZone } from "../design-system/components";
import { toast } from "../store/useToastStore";
import "./SceneListPanel.css";

export const SceneListPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  const selectScene = useAdStore((s) => s.selectScene);
  const removeScene = useAdStore((s) => s.removeScene);
  const addProductScene = useAdStore((s) => s.addProductScene);
  const addLogoScene = useAdStore((s) => s.addLogoScene);
  const setLogoImage = useAdStore((s) => s.setLogoImage);
  const reorderScenes = useAdStore((s) => s.reorderScenes);

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
                      onSelect={() => selectScene(scene.id)}
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
        </div>
      </section>
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
