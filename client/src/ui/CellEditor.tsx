import { Match, Switch } from "solid-js";
import type { Column } from "~shared/schema";

type Props = {
  column: Column;
  value: unknown;
  onChange: (value: unknown) => void;
};

export default function CellEditor(props: Props) {
  return (
    <Switch>
      <Match when={props.column.type === "checkbox"}>
        <div class="flex items-center justify-center h-9">
          <input
            type="checkbox"
            checked={!!props.value}
            onChange={(e) => props.onChange(e.currentTarget.checked)}
            class="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
        </div>
      </Match>

      <Match when={props.column.type === "number"}>
        <input
          type="number"
          class="w-full h-9 bg-transparent px-2 text-sm text-zinc-200 outline-none focus:bg-zinc-800 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={props.value != null ? String(props.value) : ""}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            props.onChange(v === "" ? null : Number(v));
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
      </Match>

      <Match when={props.column.type === "date"}>
        <input
          type="date"
          class="w-full h-9 bg-transparent px-2 text-sm text-zinc-200 outline-none focus:bg-zinc-800 [color-scheme:dark]"
          value={typeof props.value === "string" ? props.value : ""}
          onChange={(e) => props.onChange(e.currentTarget.value || null)}
        />
      </Match>

      <Match when={props.column.type === "select"}>
        <select
          class="w-full h-9 bg-transparent px-2 text-sm text-zinc-200 outline-none focus:bg-zinc-800 cursor-pointer [color-scheme:dark]"
          value={typeof props.value === "string" ? props.value : ""}
          onChange={(e) => props.onChange(e.currentTarget.value || null)}
        >
          <option value="">—</option>
          {(props.column.options ?? []).map((opt) => (
            <option value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </Match>

      <Match when={props.column.type === "text"}>
        <input
          type="text"
          class="w-full h-9 bg-transparent px-2 text-sm text-zinc-200 outline-none focus:bg-zinc-800"
          value={typeof props.value === "string" ? props.value : ""}
          onBlur={(e) => props.onChange(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
      </Match>
    </Switch>
  );
}
