// Simple DOM node registry to avoid frequent document queries during drag
// Keys should be stable strings, e.g., `slot-${machineId}-${hour}-${minute}`

const nodeMap = new Map();

export function setDomRef(key, node) {
  if (!key) return;
  if (node) nodeMap.set(key, node);
  else nodeMap.delete(key);
}

export function getDomRef(key) {
  if (!key) return null;
  return nodeMap.get(key) || null;
}

export function removeDomRef(key) {
  if (!key) return;
  nodeMap.delete(key);
}

export function clearDomRefs() {
  nodeMap.clear();
}



