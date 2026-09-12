export function beforeTaskIdAfterMove(queue, activeTaskId, overTaskId) {
  const from = queue.findIndex((task) => task.id === activeTaskId);
  const to = queue.findIndex((task) => task.id === overTaskId);
  if (from < 0 || to < 0 || from === to) return undefined;

  const reordered = [...queue];
  const [active] = reordered.splice(from, 1);
  reordered.splice(to, 0, active);
  return reordered[to + 1]?.id ?? null;
}
