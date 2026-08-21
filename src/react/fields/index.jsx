/**
 * The field dispatcher: one `FieldDef` in, one labelled control out.
 *
 * This is what makes `defineBlock` worth using — declare a `schema` and the
 * Inspector builds itself, for built-in and third-party blocks alike. There is no
 * per-block Inspector component anywhere in this package.
 *
 * @module mailkiln/react/fields
 */

import { useId } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { VarInput } from './VarInput.jsx'
import { ImageField } from './ImageField.jsx'
import { LinkField } from './LinkField.jsx'
import { ListField } from './ListField.jsx'
import { IconAlignCenter, IconAlignLeft, IconAlignRight } from '../icons.jsx'

/**
 * Read a possibly-dotted key out of a props object.
 *
 * @param {Record<string, any>} props
 * @param {string} key
 * @returns {any}
 */
export function getIn(props, key) {
  if (!key.includes('.')) return props?.[key]
  return key.split('.').reduce((cursor, part) => (cursor == null ? cursor : cursor[part]), props)
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').FieldDef} props.field
 * @param {any} props.value
 * @param {(value: any, tagKey?: string) => void} props.onChange
 * @returns {import('react').ReactElement | null}
 */
export function Field({ field, value, onChange }) {
  const t = useI18n()
  const id = useId()

  const label = (
    <label className="mk-label" htmlFor={id}>
      {field.label}
    </label>
  )
  const help = field.help ? <span className="mk-help">{field.help}</span> : null

  switch (field.type) {
    case 'text':
      return (
        <div className="mk-field">
          {label}
          <VarInput
            id={id}
            value={value ?? ''}
            placeholder={field.placeholder}
            vars={field.vars !== false}
            onChange={(next) => onChange(next, field.key)}
          />
          {help}
        </div>
      )

    // Every href in the package is a `url` field, so upgrading this case rather
    // than inventing a `link` type gives the button, image, social and video
    // blocks the special-link picker without touching a single block definition.
    case 'url':
    case 'link':
      return (
        <div className="mk-field">
          {label}
          <LinkField
            id={id}
            value={value ?? ''}
            placeholder={field.placeholder}
            vars={field.vars !== false}
            onChange={(next) => onChange(next, field.key)}
          />
          {help}
        </div>
      )

    case 'textarea':
    case 'richtext':
      return (
        <div className="mk-field">
          {label}
          <VarInput
            id={id}
            multiline
            value={value ?? ''}
            placeholder={field.placeholder}
            vars={field.vars !== false}
            onChange={(next) => onChange(next, field.key)}
          />
          {help}
        </div>
      )

    case 'number':
      return (
        <div className="mk-field">
          {label}
          <input
            id={id}
            className="mk-input"
            type="number"
            value={value ?? ''}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onChange={(event) =>
              onChange(event.target.value === '' ? '' : Number(event.target.value), field.key)
            }
          />
          {help}
        </div>
      )

    case 'range':
      return (
        <div className="mk-field">
          <div className="mk-field-row mk-field">
            {label}
            <span className="mk-value">{value}px</span>
          </div>
          <input
            id={id}
            className="mk-range"
            type="range"
            value={Number(value) || 0}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(event) => onChange(Number(event.target.value), field.key)}
          />
          {help}
        </div>
      )

    case 'color':
      return (
        <div className="mk-field">
          {label}
          <div className="mk-color">
            {/* The swatch is the native picker, made invisible and stretched over
                a styled button — `input[type=color]` cannot be styled itself, and
                its default chrome looks nothing like the rest of the panel. */}
            <span
              className="mk-color-swatch"
              data-empty={String(!value)}
              // React's CSSProperties type has no index signature for custom
              // properties, so a cast is the only way to pass one.
              style={/** @type {any} */ ({ '--mk-swatch': String(value || 'transparent') })}
            >
              <input
                id={id}
                type="color"
                value={normalizeColor(value)}
                aria-label={field.label}
                onChange={(event) => onChange(event.target.value, field.key)}
              />
            </span>
            <input
              className="mk-input"
              type="text"
              value={value ?? ''}
              placeholder="inherit"
              aria-label={`${field.label} hex`}
              onChange={(event) => onChange(event.target.value, field.key)}
            />
          </div>
          {help}
        </div>
      )

    case 'select':
    case 'font':
      return (
        <div className="mk-field">
          {label}
          <select
            id={id}
            className="mk-select"
            value={value ?? ''}
            onChange={(event) => {
              const raw = event.target.value
              const option = (field.options ?? []).find((o) => String(o.value) === raw)
              onChange(option ? option.value : raw, field.key)
            }}
          >
            {(field.options ?? []).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
          {help}
        </div>
      )

    case 'toggle':
      return (
        <div className="mk-field mk-field-row">
          <span className="mk-label" id={id}>
            {field.label}
          </span>
          <button
            type="button"
            className="mk-toggle"
            role="switch"
            aria-checked={!!value}
            aria-labelledby={id}
            onClick={() => onChange(!value, field.key)}
          />
        </div>
      )

    case 'align':
      return (
        <div className="mk-field">
          <span className="mk-label" id={id}>
            {field.label}
          </span>
          <div className="mk-seg" role="group" aria-labelledby={id}>
            {[
              ['left', t('field.alignLeft'), IconAlignLeft],
              ['center', t('field.alignCenter'), IconAlignCenter],
              ['right', t('field.alignRight'), IconAlignRight],
            ].map(([option, optionLabel, Icon]) => {
              const AlignIcon = /** @type {any} */ (Icon)
              return (
                <button
                  key={String(option)}
                  type="button"
                  aria-pressed={(value ?? 'left') === option}
                  aria-label={String(optionLabel)}
                  title={String(optionLabel)}
                  onClick={() => onChange(option, field.key)}
                >
                  <AlignIcon />
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'spacing':
      return (
        <div className="mk-field">
          {label}
          <div className="mk-spacing">
            {[
              ['top', t('field.top')],
              ['right', t('field.right')],
              ['bottom', t('field.bottom')],
              ['left', t('field.left')],
            ].map(([side, sideLabel]) => (
              <div className="mk-spacing-cell" key={side}>
                <input
                  className="mk-input"
                  type="number"
                  min={0}
                  aria-label={`${field.label} ${sideLabel}`}
                  value={value?.[side] ?? 0}
                  onChange={(event) =>
                    onChange(
                      { ...(value ?? {}), [side]: Number(event.target.value) || 0 },
                      `${field.key}.${side}`,
                    )
                  }
                />
                <span>{sideLabel}</span>
              </div>
            ))}
          </div>
          {help}
        </div>
      )

    case 'image':
      return (
        <div className="mk-field">
          {label}
          <ImageField id={id} value={value ?? ''} onChange={(next) => onChange(next, field.key)} />
          {help}
        </div>
      )

    case 'list':
      return (
        <div className="mk-field">
          {label}
          <ListField
            field={field}
            value={value}
            onChange={(next) => onChange(next, field.key)}
            FieldComponent={Field}
          />
          {help}
        </div>
      )

    default:
      return null
  }
}

/**
 * `<input type="color">` only accepts `#rrggbb`. An empty value means "inherit",
 * so show black in the swatch without writing it into the document.
 *
 * @param {any} value
 * @returns {string}
 */
function normalizeColor(value) {
  const text = String(value ?? '').trim()
  if (/^#[0-9a-f]{6}$/i.test(text)) return text
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    const [, r, g, b] = text
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return '#000000'
}

export { VarInput } from './VarInput.jsx'
export { ImageField } from './ImageField.jsx'
export { LinkField } from './LinkField.jsx'
export { ListField } from './ListField.jsx'
