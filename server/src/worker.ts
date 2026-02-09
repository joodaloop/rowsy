import { routePartykitRequest, Server } from "partyserver";
import type * as AutomergeTypes from "@automerge/automerge";
import type { SheetDoc } from "../../shared/schema";
import { newId } from "../../shared/ids";

import { generateNKeysBetween } from "jittered-fractional-indexing";

type Env = {
  SHEETS: DurableObjectNamespace<SheetServer>;
  ASSETS: Fetcher;
};

let Automerge: typeof AutomergeTypes;
async function getAutomerge() {
  if (!Automerge) {
    Automerge = await import("@automerge/automerge");
  }
  return Automerge;
}

async function makeInitialDoc(): Promise<AutomergeTypes.Doc<SheetDoc>> {
  const am = await getAutomerge();
  return am.change(am.init<SheetDoc>(), (d) => {
    d.meta = { name: "Untitled Sheet" };
    d.columns = {};
    d.rows = {};

    const colOrders = generateNKeysBetween(null, null, 2);
    const col1Id = newId();
    const col2Id = newId();
    d.columns[col1Id] = { id: col1Id, name: "Name", type: "text", order: colOrders[0] };
    d.columns[col2Id] = { id: col2Id, name: "Done", type: "checkbox", order: colOrders[1] };

    const rowOrders = generateNKeysBetween(null, null, 3);
    for (let i = 0; i < 3; i++) {
      const rowId = newId();
      d.rows[rowId] = { id: rowId, order: rowOrders[i], values: {} };
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
    const stored = await this.ctx.storage.get<Uint8Array>("doc");
    if (stored) {
      this.doc = am.load<SheetDoc>(stored);
    } else {
      this.doc = await makeInitialDoc();
    }
    if (!stored) {
      await this.persistDoc();
    }
    this.loaded = true;
  }

  private async persistDoc() {
    const am = await getAutomerge();
    const bytes = am.save(this.doc);
    await this.ctx.storage.put("doc", bytes);
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
    try {
      const am = await getAutomerge();
      await this.ensureLoaded();
      this.syncStates.set(connection.id, am.initSyncState());
      this.sendSyncMessages(connection.id, connection, am);
    } catch (e: any) {
      console.error("[SheetServer] onConnect error:", e);
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
    }
  }

  onClose(connection: import("partyserver").Connection) {
    this.syncStates.delete(connection.id);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/new") {
      const id = newId();
      return Response.redirect(new URL(`/${id}`, url.origin).toString(), 302);
    }

    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
