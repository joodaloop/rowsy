export type ColumnType = "text" | "number" | "checkbox" | "date";

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  order: string;
};

export type Row = {
  id: string;
  order: string;
  values: Record<string, unknown>;
};

export type SheetDoc = {
  meta: { name: string };
  columns: Record<string, Column>;
  rows: Record<string, Row>;
};
