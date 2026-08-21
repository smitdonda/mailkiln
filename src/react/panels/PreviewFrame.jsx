/**
 * Live preview in an iframe.
 *
 * The iframe is not optional. Email HTML is table soup with `!important` resets,
 * `html,body{margin:0!important}` among them — injected into the host page it
 * would restyle the consumer's app. `sandbox` also stops a pasted raw-HTML block
 * from running scripts inside the editor.
 *
 * @module mailkiln/react/panels/PreviewFrame
 */

import { useMemo } from 'react'
import { renderToHtml, renderToText } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'

/** Widths for the device toggle. */
export const DEVICE_WIDTHS = { desktop: 600, mobile: 375 }

/**
 * @param {object} props
 * @param {'desktop' | 'mobile' | 'text'} props.device
 * @returns {import('react').ReactElement}
 */
export function PreviewFrame({ device }) {
  const { store } = useMailKilnContext()

  const html = useMemo(
    () => (device === 'text' ? '' : renderToHtml(store.doc, { vars: store.vars })),
    [device, store.doc, store.vars],
  )
  const text = useMemo(
    () => (device === 'text' ? renderToText(store.doc, { vars: store.vars }) : ''),
    [device, store.doc, store.vars],
  )

  if (device === 'text') {
    return (
      <div className="mk-scroll">
        <pre className="mk-code">{text || '(empty)'}</pre>
      </div>
    )
  }

  const width = DEVICE_WIDTHS[device] ?? DEVICE_WIDTHS.desktop

  return (
    <div className="mk-scroll">
      <div className="mk-preview-wrap">
        <div className="mk-preview-device" data-device={device} style={{ width, maxWidth: '100%' }}>
          <iframe
            className="mk-preview-frame"
            title="Email preview"
            srcDoc={html}
            // allow-same-origin is deliberately absent: the preview needs no
            // access to the parent document, and scripts stay disabled.
            sandbox=""
          />
        </div>
      </div>
    </div>
  )
}
