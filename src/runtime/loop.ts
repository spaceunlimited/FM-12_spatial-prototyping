// One frame clock for everything: profiles, interaction, UI, blocks and experience code register
// here and core runs them in order. dt is in seconds, t in seconds since page start.
type FrameCb = (dt: number, t: number) => void;
const callbacks = new Set<FrameCb>();

/** Register a per-frame callback. Returns the function that removes it again. */
export function onFrame(cb: FrameCb): () => void {
  callbacks.add(cb);
  return () => callbacks.delete(cb);
}

/** Called by core once per rendered frame. */
export function runFrame(dt: number, t: number) {
  for (const cb of [...callbacks]) cb(dt, t);
}

export function clearFrameCallbacks() {
  callbacks.clear();
}
