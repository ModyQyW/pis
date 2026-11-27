/** Keep selected chat paths that are still visible. */
export function pruneSelection(
  selected: Set<string>,
  paths: Array<string | undefined>,
): Set<string> {
  const visible = new Set(paths.filter((path): path is string => Boolean(path)));
  const next = new Set([...selected].filter((path) => visible.has(path)));
  return next.size === selected.size ? selected : next;
}
