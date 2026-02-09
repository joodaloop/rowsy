import type { Accessor } from "solid-js";
import type * as Automerge from "@automerge/automerge";
import type { SheetDoc } from "~shared/schema";

type Props = {
  doc: SheetDoc;
  changeDoc: (fn: Automerge.ChangeFn<SheetDoc>) => void;
  connected: Accessor<boolean>;
  sheetId: string;
};

export default function Toolbar(props: Props) {
  return (
    <div class="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900">
      <input
        class="text-base font-semibold bg-transparent border border-transparent rounded px-2 py-1 text-zinc-100 hover:border-zinc-700 focus:border-blue-500 focus:outline-none transition-colors"
        value={props.doc.meta?.name ?? "Untitled"}
        onBlur={(e) => {
          const val = e.currentTarget.value;
          props.changeDoc((d) => {
            d.meta.name = val;
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <div class="ml-auto flex items-center gap-2 text-xs text-zinc-500">
        <span class="font-mono">{props.sheetId}</span>
        <div class={`w-2 h-2 rounded-full ${props.connected() ? "bg-emerald-500" : "bg-zinc-600"}`} />
        <span>{props.connected() ? "Connected" : "Offline"}</span>
      </div>
    </div>
  );
}
