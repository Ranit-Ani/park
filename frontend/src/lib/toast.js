// Tiny pub/sub so any component can fire a toast without prop drilling.
// Mirrors the original showToast(msg, type) behaviour.

let listeners = [];

export function onToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function showToast(message, type = 'success') {
  listeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, type }));
}
