import { get, set, createStore } from "idb-keyval";

const store = createStore("rows-db", "sheets");

export async function loadDocBytes(sheetId: string): Promise<Uint8Array | null> {
  const data = await get<Uint8Array>(sheetId, store);
  return data ?? null;
}

export async function saveDocBytes(sheetId: string, bytes: Uint8Array): Promise<void> {
  await set(sheetId, bytes, store);
}
