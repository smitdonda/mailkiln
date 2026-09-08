/**
 * Test environment shims.
 *
 * Runs for every spec, including the Node-environment ones — hence the `window`
 * guard. jsdom is missing three things this editor touches: `matchMedia` (the
 * `auto` appearance probe), `ResizeObserver` (dnd-kit measures droppables with
 * it) and `scrollIntoView`. All three are absent rather than broken, so a
 * minimal stand-in is enough and a mocking library would be overkill.
 *
 * @module tests/support/setup
 */

/** Enough of the interface for dnd-kit to construct one and never be called. */
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * @param {string} query
 * @returns {any}
 */
function stubMediaQuery(query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

if (typeof window !== 'undefined') {
  const globals = /** @type {any} */ (globalThis)

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: stubMediaQuery })
  }
  if (!globals.ResizeObserver) {
    globals.ResizeObserver = StubResizeObserver
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {}
  }
}
