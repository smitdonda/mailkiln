/**
 * Colour maths for the contrast rules. Small on purpose — a full CSS colour
 * parser would be a dependency, and email colours are hex, rgb() or one of a
 * handful of names in practice.
 *
 * @module mailforge/core/lint/color
 */

/** The named colours that actually turn up in email templates. */
const NAMED = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  orange: '#ffa500',
  yellow: '#ffff00',
  purple: '#800080',
  transparent: null,
  inherit: null,
  currentcolor: null,
}

/**
 * @param {string | undefined | null} value
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
export function parseColor(value) {
  if (!value) return null
  const input = String(value).trim().toLowerCase()
  if (input in NAMED) {
    const mapped = NAMED[/** @type {keyof typeof NAMED} */ (input)]
    return mapped ? parseColor(mapped) : null
  }

  let match = /^#([0-9a-f]{3,8})$/.exec(input)
  if (match) {
    const hex = match[1]
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a = 'f'] = hex.split('')
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
        a: parseInt(a + a, 16) / 255,
      }
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      }
    }
    return null
  }

  match = /^rgba?\(([^)]+)\)$/.exec(input)
  if (match) {
    const parts = match[1].split(/[,/\s]+/).filter(Boolean)
    if (parts.length < 3) return null
    /**
     * @param {string} raw
     * @returns {number}
     */
    const channel = (raw) =>
      raw.endsWith('%') ? Math.round((parseFloat(raw) / 100) * 255) : parseFloat(raw)
    return {
      r: channel(parts[0]),
      g: channel(parts[1]),
      b: channel(parts[2]),
      a: parts[3] === undefined ? 1 : parseFloat(parts[3]),
    }
  }

  return null
}

/**
 * WCAG relative luminance.
 *
 * @param {{ r: number, g: number, b: number }} color
 * @returns {number}
 */
export function luminance(color) {
  /**
   * @param {number} value
   * @returns {number}
   */
  const channel = (value) => {
    const v = Math.min(255, Math.max(0, value)) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/**
 * WCAG contrast ratio, 1–21.
 *
 * @param {string} foreground
 * @param {string} background
 * @returns {number | null} null when either colour cannot be parsed
 */
export function contrastRatio(foreground, background) {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return null
  const a = luminance(fg)
  const b = luminance(bg)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * @param {string} value
 * @returns {boolean} true when the colour is close enough to white to vanish on
 *   a dark background that the client may force
 */
export function isNearWhite(value) {
  const color = parseColor(value)
  if (!color) return false
  return luminance(color) > 0.8
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isNearBlack(value) {
  const color = parseColor(value)
  if (!color) return false
  return luminance(color) < 0.06
}
