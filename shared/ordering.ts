export function sortByOrder<T extends { order: string }>(items: Record<string, T>): T[] {
  return Object.values(items).sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}
