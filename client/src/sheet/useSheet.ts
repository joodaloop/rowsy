import { createSignal, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import * as Automerge from "@automerge/automerge";
import { PartySocket } from "partysocket";
import type { SheetDoc } from "~shared/schema";
import { loadDocBytes, saveDocBytes } from "./persistence";
import { migrateDoc } from "~shared/migrations";

export function useSheet(sheetId: string) {
  let amDoc: Automerge.Doc<SheetDoc> = Automerge.init<SheetDoc>();
  const [store, setStore] = createStore<SheetDoc>({
    meta: { name: "" },
    columns: {},
    rows: {},
  });
  const [connected, setConnected] = createSignal(false);
  const [ready, setReady] = createSignal(false);

  let syncState = Automerge.initSyncState();
  let ws: PartySocket | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function applyPatchesToStore(patches: Automerge.Patch[]) {
    if (patches.length === 0) return;
    const doc = amDoc as any;
    const updated = new Set<string>();
    setStore(produce((d: any) => {
      for (const { path } of patches) {
        if (path.length === 0) continue;
        const top = String(path[0]);
        if (updated.has(top)) continue;
        if (path.length <= 2) {
          d[top] = JSON.parse(JSON.stringify(doc[top]));
          updated.add(top);
        } else {
          const itemKey = `${top}.${path[1]}`;
          if (updated.has(itemKey)) continue;
          if (!d[top]) d[top] = {};
          if (path.length <= 3) {
            d[top][path[1]] = JSON.parse(JSON.stringify(doc[top]?.[path[1]]));
            updated.add(itemKey);
          } else {
            const leafKey = `${itemKey}.${path.slice(2).join(".")}`;
            if (updated.has(leafKey)) continue;
            let src = doc[top]?.[path[1]];
            let dst = d[top]?.[path[1]];
            for (let i = 2; i < path.length - 1; i++) {
              if (!dst[path[i]]) dst[path[i]] = {};
              dst = dst[path[i]];
              src = src?.[path[i]];
            }
            const last = path[path.length - 1];
            dst[last] = JSON.parse(JSON.stringify(src?.[last]));
            updated.add(leafKey);
          }
        }
      }
    }));
  }

  function syncStoreFromDoc() {
    const patches = Automerge.diff(amDoc, [], Automerge.getHeads(amDoc));
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
    const before = Automerge.getHeads(amDoc);
    amDoc = Automerge.change(amDoc, fn);
    applyPatchesToStore(Automerge.diff(amDoc, before, Automerge.getHeads(amDoc)));
    sendSync();
    scheduleSave();
  }

  onMount(async () => {
    const stored = await loadDocBytes(sheetId);
    if (stored) {
      try {
        amDoc = Automerge.load<SheetDoc>(stored);
        const { doc: migrated } = migrateDoc(amDoc, (d, fn) => Automerge.change(d, fn));
        amDoc = migrated;
        syncStoreFromDoc();
      } catch {
        amDoc = Automerge.init<SheetDoc>();
      }
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
      const before = Automerge.getHeads(amDoc);
      const [newDoc, newState] = Automerge.receiveSyncMessage(
        amDoc,
        syncState,
        msgBytes,
      );
      amDoc = newDoc;
      syncState = newState;
      applyPatchesToStore(Automerge.diff(amDoc, before, Automerge.getHeads(amDoc)));
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
