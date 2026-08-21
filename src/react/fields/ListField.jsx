/**
 * Repeatable list field, driven by a nested `itemSchema`.
 *
 * Exists so the plugin API can express "a list of things" — the social block uses
 * it for its links, and any third-party block gets the same editor for free. A
 * bespoke field per list-shaped block would have made the registry's `schema` a
 * half-truth.
 *
 * @module mailkiln/react/fields/ListField
 */

import { useI18n } from '../i18n/index.jsx'
import { IconPlus, IconTrash } from '../icons.jsx'

/**
 * @param {object} props
 * @param {any[]} props.value
 * @param {(value: any[]) => void} props.onChange
 * @param {import('../../core/types.js').FieldDef} props.field
 * @param {import('react').ComponentType<any>} props.FieldComponent Injected to avoid a cycle.
 * @returns {import('react').ReactElement}
 */
export function ListField({ value, onChange, field, FieldComponent }) {
  const t = useI18n()
  const items = Array.isArray(value) ? value : []

  /**
   * @param {number} index
   * @param {Record<string, any>} patch
   */
  const patchItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="mk-field">
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 8,
            border: '1px solid var(--mk-border)',
            borderRadius: 6,
            background: 'var(--mk-bg)',
          }}
        >
          <div className="mk-field-row mk-field">
            <span className="mk-label">
              {String(item?.label || item?.network || `#${index + 1}`)}
            </span>
            <button
              type="button"
              className="mk-btn mk-btn-icon"
              aria-label={t('field.removeItem')}
              title={t('field.removeItem')}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <IconTrash />
            </button>
          </div>
          {(field.itemSchema ?? []).map((itemField) => (
            <FieldComponent
              key={itemField.key}
              field={itemField}
              value={item?.[itemField.key]}
              onChange={(/** @type {any} */ next) => patchItem(index, { [itemField.key]: next })}
            />
          ))}
        </div>
      ))}

      <button
        type="button"
        className="mk-btn mk-btn-outline"
        onClick={() => onChange([...items, { ...(field.itemDefaults ?? {}) }])}
      >
        <IconPlus />
        {field.addLabel ?? t('field.addItem')}
      </button>
    </div>
  )
}
