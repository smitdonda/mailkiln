/**
 * i18n. Deliberately tiny — a lookup with `{placeholder}` interpolation and an
 * English fallback. An i18n library would be a bigger dependency than the whole
 * feature.
 *
 * @module mailkiln/react/i18n
 */

import { createContext, useContext, useMemo } from 'react'
import { en } from './en.js'
import { hi } from './hi.js'

/** @type {Record<string, Record<string, string>>} */
export const locales = { en, hi }

/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translate */

const I18nContext = createContext(/** @type {Translate} */ ((key) => en[key] ?? key))

/**
 * @param {object} props
 * @param {string} [props.locale]
 * @param {Record<string, string>} [props.messages] Overrides merged over the locale.
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export function I18nProvider({ locale = 'en', messages, children }) {
  const translate = useMemo(() => {
    const table = { ...en, ...(locales[locale] ?? {}), ...(messages ?? {}) }
    /** @type {Translate} */
    return (key, params) => {
      const template = table[key] ?? en[key] ?? key
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (whole, name) =>
        name in params ? String(params[name]) : whole,
      )
    }
  }, [locale, messages])

  return <I18nContext.Provider value={translate}>{children}</I18nContext.Provider>
}

/**
 * @returns {Translate}
 */
export function useI18n() {
  return useContext(I18nContext)
}
