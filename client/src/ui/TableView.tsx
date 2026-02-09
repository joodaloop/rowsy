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

  let tableRef: HTMLDivElement | undefined;

  function getCellInput(rowIdx: number, colIdx: number): HTMLInputElement | null {
    if (!tableRef) return null;
    const rows = tableRef.querySelectorAll("tbody tr[data-row-id]");
    const row = rows[rowIdx] as HTMLElement | undefined;
    if (!row) return null;
    const cells = row.querySelectorAll("td");
    const cell = cells[colIdx + 1] as HTMLElement | undefined;
    return cell?.querySelector("input") ?? null;
  }

  function getCellPosition(el: HTMLElement): { rowIdx: number; colIdx: number } | null {
    const td = el.closest("td");
    const tr = el.closest("tr[data-row-id]");
    if (!td || !tr || !tableRef) return null;
    const rows = tableRef.querySelectorAll("tbody tr[data-row-id]");
    const rowIdx = Array.from(rows).indexOf(tr);
    const colIdx = td.cellIndex - 1;
    if (rowIdx < 0 || colIdx < 0) return null;
    return { rowIdx, colIdx };
  }

  function focusCell(rowIdx: number, colIdx: number, cursorPos?: "start" | "end") {
    const input = getCellInput(rowIdx, colIdx);
    if (!input) return;
    input.focus();
    if (cursorPos === "start") {
      input.setSelectionRange(0, 0);
    } else if (cursorPos === "end") {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function addRowAfter(currentRowIdx: number): string {
    const rows = sortedRows();
    const cols = sortedColumns();
    const before = rows[currentRowIdx]?.order ?? null;
    const after = currentRowIdx + 1 < rows.length ? rows[currentRowIdx + 1].order ?? null : null;
    const id = newId();
    const order = generateKeyBetween(before, after);
    props.changeDoc((d) => {
      ensureShape(d);
      d.rows[id] = { id, order, values: {} };
    });
    return id;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const active = document.activeElement as HTMLInputElement | null;
    if (!active || !tableRef?.contains(active)) return;
    const pos = getCellPosition(active);
    if (!pos) return;

    const numRows = sortedRows().length;
    const numCols = sortedColumns().length;

    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const tr = active.closest("tr[data-row-id]") as HTMLElement;
      const rowId = tr.dataset.rowId!;
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const selStart = active.selectionStart;
      const selEnd = active.selectionEnd;

      e.preventDefault();
      moveRow(rowId, direction);

      requestAnimationFrame(() => {
        const newRow = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!newRow) return;
        const newCell = newRow.children[pos.colIdx + 1] as HTMLElement | undefined;
        const newInput = newCell?.querySelector("input") as HTMLInputElement | null;
        if (newInput) {
          newInput.focus();
          if (selStart != null && selEnd != null) {
            newInput.setSelectionRange(selStart, selEnd);
          }
        }
      });
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      active.blur();
      addRowAfter(pos.rowIdx);
      requestAnimationFrame(() => focusCell(pos.rowIdx + 1, 0, "start"));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      active.blur();
      let nextRow = pos.rowIdx;
      let nextCol = pos.colIdx + 1;
      if (nextCol >= numCols) {
        nextCol = 0;
        nextRow++;
      }
      if (nextRow < numRows) {
        requestAnimationFrame(() => focusCell(nextRow, nextCol, "start"));
      }
      return;
    }

    if (e.key === "ArrowRight" && active.selectionStart === active.value.length && active.selectionEnd === active.value.length) {
      let nextRow = pos.rowIdx;
      let nextCol = pos.colIdx + 1;
      if (nextCol >= numCols) {
        nextCol = 0;
        nextRow++;
      }
      if (nextRow < numRows) {
        e.preventDefault();
        focusCell(nextRow, nextCol, "start");
      }
      return;
    }

    if (e.key === "ArrowLeft" && active.selectionStart === 0 && active.selectionEnd === 0) {
      let prevRow = pos.rowIdx;
      let prevCol = pos.colIdx - 1;
      if (prevCol < 0) {
        prevCol = numCols - 1;
        prevRow--;
      }
      if (prevRow >= 0) {
        e.preventDefault();
        focusCell(prevRow, prevCol, "end");
      }
      return;
    }

    if (e.key === "ArrowDown") {
      if (pos.rowIdx + 1 < numRows) {
        e.preventDefault();
        focusCell(pos.rowIdx + 1, pos.colIdx, "start");
      }
      return;
    }

    if (e.key === "ArrowUp") {
      if (pos.rowIdx - 1 >= 0) {
        e.preventDefault();
        focusCell(pos.rowIdx - 1, pos.colIdx, "start");
      }
      return;
    }
  }

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return (
    <div class="min-w-max" ref={tableRef}>
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
