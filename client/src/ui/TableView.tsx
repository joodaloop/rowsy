import { For, createMemo, onMount, onCleanup } from "solid-js";
import type * as Automerge from "@automerge/automerge";
import type { SheetDoc } from "~shared/schema";
import { newId } from "~shared/ids";
import { sortByOrder } from "~shared/ordering";
import { generateKeyBetween } from "jittered-fractional-indexing";
import CellEditor from "./CellEditor";
import ColumnHeader from "./ColumnHeader";

type Props = {
  doc: SheetDoc;
  changeDoc: (fn: Automerge.ChangeFn<SheetDoc>) => void;
};

export default function TableView(props: Props) {
  const sortedColumns = createMemo(() => sortByOrder(props.doc.columns ?? {}));
  const sortedRows = createMemo(() => sortByOrder(props.doc.rows ?? {}));

  function ensureShape(d: SheetDoc) {
    if (!d.meta) d.meta = { name: "Untitled Sheet" };
    if (!d.columns) d.columns = {};
    if (!d.rows) d.rows = {};
  }

  function addColumn() {
    const cols = sortedColumns();
    const lastOrder = cols.length > 0 ? (cols[cols.length - 1].order ?? null) : null;
    const id = newId();
    const order = generateKeyBetween(lastOrder, null);
    props.changeDoc((d) => {
      ensureShape(d);
      d.columns[id] = { id, name: "New Column", type: "text", order };
    });
  }

  function addRow() {
    const rows = sortedRows();
    const lastOrder = rows.length > 0 ? (rows[rows.length - 1].order ?? null) : null;
    const id = newId();
    const order = generateKeyBetween(lastOrder, null);
    props.changeDoc((d) => {
      ensureShape(d);
      d.rows[id] = { id, order, values: {} };
    });
  }

  function deleteRow(rowId: string) {
    props.changeDoc((d) => {
      delete d.rows[rowId];
    });
  }

  function deleteColumn(colId: string) {
    props.changeDoc((d) => {
      delete d.columns[colId];
      for (const rowId of Object.keys(d.rows)) {
        delete d.rows[rowId].values[colId];
      }
    });
  }

  function updateColumnName(colId: string, name: string) {
    props.changeDoc((d) => {
      d.columns[colId].name = name;
    });
  }

  function moveRow(rowId: string, direction: -1 | 1) {
    const rows = sortedRows();
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    let newOrder: string;
    if (direction === -1) {
      const before = targetIdx > 0 ? (rows[targetIdx - 1].order ?? null) : null;
      const after = rows[targetIdx].order ?? null;
      newOrder = generateKeyBetween(before, after);
    } else {
      const before = rows[targetIdx].order ?? null;
      const after = targetIdx + 1 < rows.length ? (rows[targetIdx + 1].order ?? null) : null;
      newOrder = generateKeyBetween(before, after);
    }

    props.changeDoc((d) => {
      d.rows[rowId].order = newOrder;
    });
  }

  function updateCell(rowId: string, colId: string, value: unknown) {
    props.changeDoc((d) => {
      d.rows[rowId].values[colId] = value;
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;

    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const tr = active.closest("tr[data-row-id]");
    if (!tr) return;

    const rowId = (tr as HTMLElement).dataset.rowId!;
    const direction = e.key === "ArrowUp" ? -1 : 1;

    const td = active.closest("td");
    const cellIndex = td ? td.cellIndex : -1;
    const input = active as HTMLInputElement;
    const selStart = input.selectionStart;
    const selEnd = input.selectionEnd;

    e.preventDefault();
    moveRow(rowId, direction);

    requestAnimationFrame(() => {
      const newRow = document.querySelector(`tr[data-row-id="${rowId}"]`);
      if (!newRow) return;
      const newCell = newRow.children[cellIndex] as HTMLElement | undefined;
      const newInput = newCell?.querySelector("input") as HTMLInputElement | null;
      if (newInput) {
        newInput.focus();
        if (selStart != null && selEnd != null) {
          newInput.setSelectionRange(selStart, selEnd);
        }
      }
    });
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return (
    <div class="min-w-max">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-zinc-900 sticky top-0 z-10">
            <th class="w-10 px-2 py-2 border-b border-r border-zinc-800 text-zinc-500 text-xs font-normal">#</th>
            <For each={sortedColumns()}>
              {(col) => (
                <ColumnHeader
                  column={col}
                  onRename={(name) => updateColumnName(col.id, name)}
                  onDelete={() => deleteColumn(col.id)}
                />
              )}
            </For>
            <th class="w-10 border-b border-zinc-800">
              <button
                onClick={addColumn}
                class="w-full h-full px-3 py-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-sm"
                title="Add column"
              >
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={sortedRows()}>
            {(row, rowIndex) => (
              <tr class="group hover:bg-zinc-900/50" data-row-id={row.id}>
                <td class="px-2 py-0 border-b border-r border-zinc-800/50 text-zinc-600 text-xs text-center relative">
                  <span class="group-hover:hidden">{rowIndex() + 1}</span>
                  <button
                    onClick={() => deleteRow(row.id)}
                    class="hidden group-hover:inline text-red-500 hover:text-red-400"
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
                <For each={sortedColumns()}>
                  {(col) => (
                    <td class="px-0 py-0 border-b border-r border-zinc-800/50">
                      <CellEditor
                        column={col}
                        value={row.values[col.id]}
                        onChange={(val) => updateCell(row.id, col.id, val)}
                      />
                    </td>
                  )}
                </For>
                <td class="border-b border-zinc-800/50" />
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <button
        onClick={addRow}
        class="w-full text-left px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50"
      >
        + New row
      </button>
    </div>
  );
}
