export type ColumnType = "text" | "number" | "checkbox" | "date" | "select";

export type SelectOption = {
  id: string;
  label: string;
  color: string;
};

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[];
};

export type Row = {
  id: string;
  values: Record<string, unknown>;
};

export type SheetDoc = {
  meta: { name: string; schemaVersion: number };
  columns: Column[];
  rows: Row[];
};
