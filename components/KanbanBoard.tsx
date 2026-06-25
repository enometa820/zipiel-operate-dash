"use client";

import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import type { CollaborationView } from "@/lib/data";
import { PHASES, PHASE_META, STATUS_PHASE, type BoardColumn } from "@/lib/types";
import { CollaborationCard } from "./CollaborationCard";

type Col = BoardColumn;
const COLUMNS: Col[] = [...PHASES, "Seeding", "Dropped"];

function Column({ col, items }: { col: Col; items: CollaborationView[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col });
  const meta = PHASE_META[col];
  return (
    <div className="flex flex-col w-[260px] shrink-0">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.accent }} />
        <span className="text-sm font-semibold">{meta.label}</span>
        <span className="text-xs text-[var(--muted)]">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 rounded-xl min-h-[120px] flex-1 transition-colors ${
          isOver ? "bg-[var(--accent-soft)]" : "bg-[var(--panel-2)]"
        }`}
        style={{ border: `1px dashed ${isOver ? meta.accent : "var(--border)"}` }}
      >
        {items.slice(0, 50).map((co) => (
          <CollaborationCard key={co.id} co={co} />
        ))}
        {items.length > 50 && (
          <div className="text-[11px] text-[var(--muted)] text-center py-2">
            +{items.length - 50} more — use Table view to browse
          </div>
        )}
        {items.length === 0 && (
          <div className="text-[11px] text-[var(--faint)] text-center py-6">No cards</div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  views,
  onMove,
}: {
  views: CollaborationView[];
  onMove: (coId: string, col: Col) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (e.over) onMove(String(e.active.id), e.over.id as Col);
  }

  const active = views.find((v) => v.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 kanban-scroll">
        {COLUMNS.map((col) => (
          <Column
            key={col}
            col={col}
            items={views.filter((v) => STATUS_PHASE[v.status] === col)}
          />
        ))}
      </div>
      <DragOverlay>{active ? <CollaborationCard co={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
