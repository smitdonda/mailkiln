/**
 * Editor theming: a small token object in, CSS custom properties out.
 *
 * Deliberately not a design-system dependency. The consumer passes six colours
 * at most; everything else is derived in CSS with `color-mix`. Tokens are applied
 * as inline custom properties on `.mk-root`, so two mailkiln instances on one
 * page can have different themes.
 *
 * @module mailkiln/core/theme
 */

/**
 * @typedef {object} Theme
 * @property {string} [accent] Primary colour: selection outlines, primary buttons.
 * @property {string} [accentContrast] Text colour on top of `accent`.
 * @property {string} [background] Panel background.
 * @property {string} [backgroundSubtle] Sidebar background.
 * @property {string} [backgroundSunken] Canvas background.
 * @property {string} [border]
 * @property {string} [borderStrong]
 * @property {string} [foreground] Body text.
 * @property {string} [foregroundMuted] Labels, help text.
 * @property {string} [danger]
 * @property {string} [warn]
 * @property {string} [info]
 * @property {string | number} [radius] Corner radius; a number is treated as px.
 * @property {string} [fontFamily] UI font stack.
 * @property {string} [fontMono] Code font stack.
 */

/**
 * Theme key -> CSS custom property.
 *
 * These names deliberately avoid Tailwind's prefixed theme namespaces
 * (`--mk-color-*`, `--mk-font-*`, `--mk-text-*`): colliding with one makes
 * Tailwind emit its own default into `:root, :host`, which is a style leak into
 * the consumer's page.
 */
export const THEME_VARS = {
  accent: '--mk-accent',
  accentContrast: '--mk-accent-contrast',
  background: '--mk-bg',
  backgroundSubtle: '--mk-bg-subtle',
  backgroundSunken: '--mk-bg-sunken',
  border: '--mk-border',
  borderStrong: '--mk-border-strong',
  foreground: '--mk-fg',
  foregroundMuted: '--mk-fg-muted',
  danger: '--mk-danger',
  warn: '--mk-warn',
  info: '--mk-info',
  radius: '--mk-radius',
  fontFamily: '--mk-ui-font',
  fontMono: '--mk-ui-mono',
}

/** Keys whose numeric values mean px. */
const PX_KEYS = new Set(['radius'])

/**
 * Convert a theme object to a style object suitable for a React `style` prop.
 *
 * @param {Theme | null | undefined} theme
 * @returns {Record<string, string>}
 */
export function themeToCssVars(theme) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!theme) return out
  for (const [key, value] of Object.entries(theme)) {
    const cssVar = THEME_VARS[/** @type {keyof typeof THEME_VARS} */ (key)]
    if (!cssVar || value == null || value === '') continue
    out[cssVar] = typeof value === 'number' && PX_KEYS.has(key) ? `${value}px` : String(value)
  }
  return out
}

/**
 * Unknown theme keys are almost always a typo, and a typo'd theme silently does
 * nothing. Returns the offending keys so the editor can warn once in dev.
 *
 * @param {Theme | null | undefined} theme
 * @returns {string[]}
 */
export function unknownThemeKeys(theme) {
  if (!theme) return []
  return Object.keys(theme).filter((key) => !(key in THEME_VARS))
}
