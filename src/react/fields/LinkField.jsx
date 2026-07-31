/**
 * The control behind every `url` (or `link`) field.
 *
 * A plain text box was the whole story until now, which left the linter in an
 * absurd position: the `unsubscribe` rule tells you the link is missing, and the
 * editor gives you no way to add one short of knowing your ESP's merge-tag
 * spelling by heart. So the box grew a picker for the three links that come from
 * the sending platform rather than from your data.
 *
 * The list is `SPECIAL_LINKS` from core — the same one the unknown-variable rule
 * treats as implicitly declared, so anything insertable here is guaranteed not to
 * be reported as an undeclared variable. Consumers can replace it wholesale with
 * the `specialLinks` prop on `<MailForge>`, because an ESP that spells it
 * `{{unsub}}` should not be stuck with ours.
 *
 * @module mailforge/react/fields/LinkField
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { SPECIAL_LINK_PATHS } from '../../core/index.js'
import { useMailForgeContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { IconChevronRight } from '../icons.jsx'
import { VarInput } from './VarInput.jsx'

/** Core knows the paths; only the editor knows what to call them. */
const LABEL_KEYS = {
  unsubscribe_url: 'link.unsubscribe',
  preferences_url: 'link.preferences',
  view_in_browser_url: 'link.viewInBrowser',
}

/**
 * @param {object} props
 * @param {string} [props.id]
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.vars]
 * @returns {import('react').ReactElement}
 */
export function LinkField({ id, value, onChange, placeholder, vars = true }) {
  const t = useI18n()
  const { specialLinks } = useMailForgeContext()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const links = useMemo(
    () =>
      specialLinks ??
      SPECIAL_LINK_PATHS.map((path) => ({ label: t(LABEL_KEYS[path]), value: `{{${path}}}` })),
    [specialLinks, t],
  )

  // A menu that only closes on its own button is a menu people leave open.
  useEffect(() => {
    if (!open) return undefined
    const onDown = (/** @type {MouseEvent} */ event) => {
      const target = /** @type {Node} */ (event.target)
      if (!wrapRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!links.length) {
    return (
      <VarInput id={id} value={value} onChange={onChange} placeholder={placeholder} vars={vars} />
    )
  }

  return (
    <div className="mf-link-field" ref={wrapRef}>
      <VarInput id={id} value={value} onChange={onChange} placeholder={placeholder} vars={vars} />
      <button
        type="button"
        className="mf-btn mf-btn-icon mf-link-pick"
        aria-label={t('link.special')}
        aria-expanded={open}
        title={t('link.special')}
        onClick={() => setOpen((was) => !was)}
      >
        <IconChevronRight />
      </button>
      {open ? (
        <ul className="mf-var-menu" role="listbox" aria-label={t('link.special')}>
          {links.map((link) => (
            <li
              key={link.value}
              role="option"
              aria-selected={value === link.value}
              className="mf-var-item"
              data-active={value === link.value || undefined}
              onMouseDown={(event) => {
                event.preventDefault()
                onChange(link.value)
                setOpen(false)
              }}
            >
              <span>{link.label}</span>
              <span className="mf-var-sample">{link.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
