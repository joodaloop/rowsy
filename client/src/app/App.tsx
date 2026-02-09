import { createSignal, onMount, Show } from "solid-js";
import SheetView from "../ui/SheetView";
import { newId } from "~shared/ids";

export default function App() {
  const [sheetId, setSheetId] = createSignal<string | null>(null);

  onMount(() => {
    const path = window.location.pathname;
    if (path === "/" || path === "" || path === "/new") {
      const id = newId();
      window.history.replaceState(null, "", `/${id}`);
      setSheetId(id);
      return;
    }
    setSheetId(path.slice(1));
  });

  return (
    <Show when={sheetId()} fallback={
      <div class="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    }>
      {(id) => <SheetView sheetId={id()} />}
    </Show>
  );
}
