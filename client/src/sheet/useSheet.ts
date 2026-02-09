import { createSignal, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import * as Automerge from "@automerge/automerge";
import { PartySocket } from "partysocket";
import type { SheetDoc } from "~shared/schema";
import { newId } from "~shared/ids";
import { loadDocBytes, saveDocBytes } from "./persistence";

function makeInitialDoc(): Automerge.Doc<SheetDoc> {
  return Automerge.change(Automerge.init<SheetDoc>(), (d) => {
    d.meta = { name: "Untitled Sheet", schemaVersion: 1 };
    d.columns = [];
    d.rows = [];
    const col1 = { id: newId(), name: "Name", type: "text" as const };
    const col2 = { id: newId(), name: "Status", type: "select" as const, options: [] };
    d.columns.push(col1);
    d.columns.push(col2);
    for (let i = 0; i < 3; i++) {
      d.rows.push({ id: newId(), values: {} });
    }
  });
}

export function useSheet(sheetId: string) {
  let amDoc: Automerge.Doc<SheetDoc> = Automerge.init<SheetDoc>();
  const [store, setStore] = createStore<SheetDoc>({
    meta: { name: "", schemaVersion: 0 },
    columns: [],
    rows: [],
  });
  const [connected, setConnected] = createSignal(false);
  const [ready, setReady] = createSignal(false);

  let syncState = Automerge.initSyncState();
  let ws: PartySocket | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function applyPatchesToStore(patches: Automerge.Patch[]) {
    setStore(produce((d) => Automerge.applyPatches(d, patches)));
  }

  function loadIntoStore(doc: Automerge.Doc<SheetDoc>) {
    amDoc = doc;
    const patches = Automerge.diff(doc, [], Automerge.getHeads(doc));
    applyPatchesToStore(patches);
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveDocBytes(sheetId, Automerge.save(amDoc));
    }, 300);
  }

  function sendSync() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let iterations = 0;
    while (iterations++ < 100) {
      const [nextState, msg] = Automerge.generateSyncMessage(amDoc, syncState);
      syncState = nextState;
      if (!msg) break;
      ws.send(msg);
    }
  }

  function changeDoc(fn: Automerge.ChangeFn<SheetDoc>) {
    amDoc = Automerge.change(amDoc, {
      patchCallback: (patches) => applyPatchesToStore(patches),
    }, fn);
    sendSync();
    scheduleSave();
  }

  onMount(async () => {
    const stored = await loadDocBytes(sheetId);
    if (stored) {
      try {
        loadIntoStore(Automerge.load<SheetDoc>(stored));
      } catch {
        loadIntoStore(makeInitialDoc());
      }
    } else {
      loadIntoStore(makeInitialDoc());
    }
    setReady(true);

    const isDev = window.location.port === "5173";
    ws = new PartySocket({
      host: isDev ? "localhost:8787" : window.location.host,
      party: "sheets",
      room: sheetId,
    });

    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      setConnected(true);
      syncState = Automerge.initSyncState();
      sendSync();
    });

    ws.addEventListener("close", () => setConnected(false));

    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") return;
      const msgBytes = new Uint8Array(event.data as ArrayBuffer);
      const [newDoc, newState] = Automerge.receiveSyncMessage(
        amDoc,
        syncState,
        msgBytes,
        { patchCallback: (patches) => applyPatchesToStore(patches) }
      );
      amDoc = newDoc;
      syncState = newState;
      sendSync();
      scheduleSave();
    });
  });

  onCleanup(() => {
    ws?.close();
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveDocBytes(sheetId, Automerge.save(amDoc));
    }
  });

  return { doc: store, changeDoc, connected, ready };
}
