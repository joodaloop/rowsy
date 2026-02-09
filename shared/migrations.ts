import type { SheetDoc } from "./schema";

type ChangeFn<T> = (doc: T) => void;

type Migration = {
  name: string;
  needed: (doc: any) => boolean;
  apply: ChangeFn<any>;
};

const migrations: Migration[] = [
  {
    name: "arrays-to-maps",
    needed: (doc) => Array.isArray(doc.columns) || Array.isArray(doc.rows),
    apply: (d: any) => {
      if (Array.isArray(d.columns)) {
        const cols = [...d.columns];
        d.columns = {};
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i];
          d.columns[col.id] = { ...col, order: String(i).padStart(5, "0") };
        }
      }
      if (Array.isArray(d.rows)) {
        const rows = [...d.rows];
        d.rows = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          d.rows[row.id] = { ...row, order: String(i).padStart(5, "0") };
        }
      }
    },
  },
];

export function migrateDoc<D extends SheetDoc>(
  doc: D,
  change: (doc: D, fn: ChangeFn<SheetDoc>) => D,
): { doc: D; applied: string[] } {
  const applied: string[] = [];
  for (const m of migrations) {
    if (m.needed(doc as unknown as SheetDoc)) {
      doc = change(doc, m.apply);
      applied.push(m.name);
    }
  }
  return { doc, applied };
}
