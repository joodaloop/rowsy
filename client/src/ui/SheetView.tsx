import { Show } from "solid-js";
import { useSheet } from "../sheet/useSheet";
import TableView from "./TableView";
import Toolbar from "./Toolbar";

export default function SheetView(props: { sheetId: string }) {
  const { doc, changeDoc, connected, ready } = useSheet(props.sheetId);

  return (
    <div class="flex flex-col h-screen bg-zinc-950 text-zinc-200">
      <Show when={ready()} fallback={
        <div class="flex items-center justify-center h-screen text-zinc-500">
          Loading document...
        </div>
      }>
        <Toolbar doc={doc} changeDoc={changeDoc} connected={connected} sheetId={props.sheetId} />
        <div class="flex-1 overflow-auto">
          <TableView doc={doc} changeDoc={changeDoc} />
        </div>
      </Show>
    </div>
  );
}
