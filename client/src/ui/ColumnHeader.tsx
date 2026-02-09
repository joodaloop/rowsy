import { createSignal, Show } from "solid-js";
import type { Column, ColumnType } from "~shared/schema";

const TYPE_LABELS: Record<ColumnType, string> = {
  text: "Abc",
  number: "#",
  checkbox: "☑",
  date: "📅",
};

type Props = {
  column: Column;
  onRename: (name: string) => void;
  onDelete: () => void;
};

export default function ColumnHeader(props: Props) {
  const [menuOpen, setMenuOpen] = createSignal(false);

  return (
    <th class="relative min-w-40 border-b border-r border-zinc-800 text-left font-normal text-sm">
      <div class="flex justify-between">
        <input
          class="flex-1 bg-transparent px-1 py-2 text-zinc-300 text-sm outline-none"
          value={props.column.name}
          onBlur={(e) => props.onRename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <button
          onClick={() => setMenuOpen(!menuOpen())}
          class="p-2 text-zinc-500 hover:text-zinc-300 text-xs"
          title={props.column.type}
        >
          -{/*{TYPE_LABELS[props.column.type]}*/}
        </button>
      </div>

      <Show when={menuOpen()}>
        <div
          class="absolute top-2/3 right-0 z-20 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            class="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
            onClick={() => {
              props.onDelete();
              setMenuOpen(false);
            }}
          >
            Delete column
          </button>
        </div>
      </Show>
    </th>
  );
}
