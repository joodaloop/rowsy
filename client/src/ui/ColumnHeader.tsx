import { createSignal, Show } from "solid-js";
import type { Column, ColumnType } from "~shared/schema";

const TYPE_LABELS: Record<ColumnType, string> = {
  text: "Abc",
  number: "#",
  checkbox: "☑",
  date: "📅",
  select: "▼",
};

const COLUMN_TYPES: ColumnType[] = ["text", "number", "checkbox", "date", "select"];

type Props = {
  column: Column;
  onRename: (name: string) => void;
  onChangeType: (type: ColumnType) => void;
  onDelete: () => void;
};

export default function ColumnHeader(props: Props) {
  const [menuOpen, setMenuOpen] = createSignal(false);

  return (
    <th class="relative min-w-[160px] border-b border-r border-zinc-800 text-left font-normal text-sm">
      <div class="flex items-center">
        <button
          onClick={() => setMenuOpen(!menuOpen())}
          class="px-1.5 py-2 text-zinc-500 hover:text-zinc-300 text-xs"
          title={props.column.type}
        >
          {TYPE_LABELS[props.column.type]}
        </button>
        <input
          class="flex-1 bg-transparent px-1 py-2 text-zinc-300 text-sm outline-none"
          value={props.column.name}
          onBlur={(e) => props.onRename(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
      </div>

      <Show when={menuOpen()}>
        <div
          class="absolute top-full left-0 z-20 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <div class="px-3 py-1.5 text-xs text-zinc-500 uppercase tracking-wider">Type</div>
          {COLUMN_TYPES.map((t) => (
            <button
              class={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 transition-colors ${
                props.column.type === t ? "text-blue-400" : "text-zinc-300"
              }`}
              onClick={() => { props.onChangeType(t); setMenuOpen(false); }}
            >
              {TYPE_LABELS[t]} {t}
            </button>
          ))}
          <div class="border-t border-zinc-700 mt-1 pt-1">
            <button
              class="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
              onClick={() => { props.onDelete(); setMenuOpen(false); }}
            >
              Delete column
            </button>
          </div>
        </div>
      </Show>
    </th>
  );
}
