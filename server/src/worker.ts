import { routePartykitRequest, Server } from "partyserver";
import type * as AutomergeTypes from "@automerge/automerge";
import type { SheetDoc } from "../../shared/schema";
import { newId } from "../../shared/ids";

type Env = {
  SHEETS: DurableObjectNamespace<SheetServer>;
  ASSETS: Fetcher;
};

let Automerge: typeof AutomergeTypes;
async function getAutomerge() {
  if (!Automerge) {
    console.log("[SheetServer] loading Automerge...");
    try {
      Automerge = await import("@automerge/automerge");
      console.log("[SheetServer] Automerge loaded OK");
    } catch (e: any) {
      console.error("[SheetServer] Automerge import FAILED:", e);
      console.error("[SheetServer] Automerge import stack:", e?.stack);
      throw e;
    }
  }
  return Automerge;
}

async function makeInitialDoc(): Promise<AutomergeTypes.Doc<SheetDoc>> {
  const am = await getAutomerge();
  return am.change(am.init<SheetDoc>(), (d) => {
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

export class SheetServer extends Server<Env> {
  static options = { hibernate: true };

  private doc!: AutomergeTypes.Doc<SheetDoc>;
  private syncStates = new Map<string, AutomergeTypes.SyncState>();
  private loaded = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private async ensureLoaded() {
    if (this.loaded) return;
    const am = await getAutomerge();
    const stored = await this.ctx.storage.get<number[]>("doc");
    if (stored) {
      this.doc = am.load<SheetDoc>(new Uint8Array(stored));
    } else {
      this.doc = await makeInitialDoc();
      await this.persistDoc();
    }
    this.loaded = true;
  }

  private async persistDoc() {
    const am = await getAutomerge();
    const bytes = am.save(this.doc);
    await this.ctx.storage.put("doc", Array.from(bytes));
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.persistDoc();
    }, 500);
  }

  private sendSyncMessages(connectionId: string, ws: WebSocket, am: typeof AutomergeTypes) {
    let state = this.syncStates.get(connectionId) ?? am.initSyncState();
    let iterations = 0;
    while (iterations++ < 100) {
      const [nextState, msg] = am.generateSyncMessage(this.doc, state);
      state = nextState;
      if (!msg) break;
      ws.send(msg);
    }
    this.syncStates.set(connectionId, state);
  }

  async onConnect(connection: import("partyserver").Connection) {
    console.log("[SheetServer] onConnect called, id:", connection.id);
    try {
      const am = await getAutomerge();
      console.log("[SheetServer] Automerge ready, loading doc...");
      await this.ensureLoaded();
      console.log("[SheetServer] doc loaded, sending sync...");
      this.syncStates.set(connection.id, am.initSyncState());
      this.sendSyncMessages(connection.id, connection, am);
      console.log("[SheetServer] onConnect done OK");
    } catch (e: any) {
      console.error("[SheetServer] onConnect error:", e);
      console.error("[SheetServer] onConnect stack:", e?.stack);
      connection.send(JSON.stringify({ error: String(e) }));
    }
  }

  async onMessage(connection: import("partyserver").Connection, message: string | ArrayBuffer) {
    if (typeof message === "string") return;
    try {
      const am = await getAutomerge();
      await this.ensureLoaded();

      const msgBytes = new Uint8Array(message);
      let state = this.syncStates.get(connection.id);
      if (!state) {
        state = am.initSyncState();
      }

      const [newDoc, newState] = am.receiveSyncMessage(
        this.doc,
        state,
        msgBytes
      );
      this.doc = newDoc;
      this.syncStates.set(connection.id, newState);

      this.sendSyncMessages(connection.id, connection, am);

      for (const conn of this.getConnections()) {
        if (conn.id === connection.id) continue;
        try {
          this.sendSyncMessages(conn.id, conn, am);
        } catch {
          this.syncStates.delete(conn.id);
        }
      }

      this.scheduleSave();
    } catch (e: any) {
      console.error("[SheetServer] onMessage error:", e);
      console.error("[SheetServer] onMessage stack:", e?.stack);
    }
  }

  onClose(connection: import("partyserver").Connection) {
    this.syncStates.delete(connection.id);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log("[SheetServer] fetch:", request.method, url.pathname, "upgrade:", request.headers.get("upgrade"));

    if (url.pathname === "/new") {
      const id = newId();
      return Response.redirect(new URL(`/${id}`, url.origin).toString(), 302);
    }

    const partyResponse = await routePartykitRequest(request, env);
    console.log("[SheetServer] routePartykitRequest returned:", partyResponse ? partyResponse.status : "null");
    if (partyResponse) return partyResponse;

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
