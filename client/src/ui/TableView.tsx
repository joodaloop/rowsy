import { For } from "solid-js";
import type * as Automerge from "@automerge/automerge";
import type { SheetDoc, ColumnType } from "~shared/schema";
import { newId } from "~shared/ids";
import CellEditor from "./CellEditor";
import ColumnHeader from "./ColumnHeader";

type Props = {
  doc: SheetDoc;
  changeDoc: (fn: Automerge.ChangeFn<SheetDoc>) => void;
};

export default function TableView(props: Props) {
  function addColumn() {
    props.changeDoc((d) => {
      d.columns.push({ id: newId(), name: "New Column", type: "text" });
    });
  }

  function addRow() {
    props.changeDoc((d) => {
      d.rows.push({ id: newId(), values: {} });
    });
  }

  function deleteRow(rowIndex: number) {
    props.changeDoc((d) => {
      d.rows.splice(rowIndex, 1);
    });
  }

  function deleteColumn(colIndex: number) {
    props.changeDoc((d) => {
      const colId = d.columns[colIndex].id;
      d.columns.splice(colIndex, 1);
      for (const row of d.rows) {
        delete row.values[colId];
      }
    });
  }

  function updateColumnName(colIndex: number, name: string) {
    props.changeDoc((d) => {
      d.columns[colIndex].name = name;
    });
  }

  function updateColumnType(colIndex: number, type: ColumnType) {
    props.changeDoc((d) => {
      d.columns[colIndex].type = type;
    });
  }

  function updateCell(rowIndex: number, colId: string, value: unknown) {
    props.changeDoc((d) => {
      d.rows[rowIndex].values[colId] = value;
    });
  }

  return (
    <div class="min-w-max">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-zinc-900 sticky top-0 z-10">
            <th class="w-10 px-2 py-2 border-b border-r border-zinc-800 text-zinc-500 text-xs font-normal">#</th>
            <For each={props.doc.columns}>
              {(col, colIndex) => (
                <ColumnHeader
                  column={col}
                  onRename={(name) => updateColumnName(colIndex(), name)}
                  onChangeType={(type) => updateColumnType(colIndex(), type)}
                  onDelete={() => deleteColumn(colIndex())}
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
          <For each={props.doc.rows}>
            {(row, rowIndex) => (
              <tr class="group hover:bg-zinc-900/50">
                <td class="px-2 py-0 border-b border-r border-zinc-800/50 text-zinc-600 text-xs text-center relative">
                  <span class="group-hover:hidden">{rowIndex() + 1}</span>
                  <button
                    onClick={() => deleteRow(rowIndex())}
                    class="hidden group-hover:inline text-red-500 hover:text-red-400"
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
                <For each={props.doc.columns}>
                  {(col) => (
                    <td class="px-0 py-0 border-b border-r border-zinc-800/50">
                      <CellEditor
                        column={col}
                        value={row.values[col.id]}
                        onChange={(val) => updateCell(rowIndex(), col.id, val)}
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
