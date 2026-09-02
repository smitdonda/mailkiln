import { useState } from 'react'
import { MailKiln } from 'mailkiln'
import { createDocument, defineBlock, defineVars, normalize, spacing } from 'mailkiln/core'
import 'mailkiln/style.css'

// --- pillar 4: one sample object drives autocomplete, lint, preview and the
// typed export. Try typing {{ in any text field.
// Covers what the built-in starter templates reference, so picking one gives a
// clean Checks panel instead of a pile of undeclared-variable errors.
const vars = defineVars({
  sample: {
    user: { name: 'Smit', email: 'smit@example.com' },
    order: {
      id: 'MK-2291',
      total: '£133.99',
      eta: 'Thursday',
      items: [{ title: 'Mechanical keyboard', price: '£129.00' }],
    },
    product: { name: 'Acme' },
    issue: { name: 'The Weekly', number: 42, title: 'Three things worth your time' },
    reset_url: 'https://example.com/reset?token=abc',
    preferences_url: 'https://example.com/preferences',
    unsubscribe_url: 'https://example.com/unsubscribe?u=123',
  },
})

// --- a custom block, declared with the same defineBlock() the built-ins use.
// It gets a palette entry, a generated Inspector, HTML/JSX/MJML/text output, its
// own lint rule and a parse hook for HTML import — all from this one object.
const countdownBlock = defineBlock({
  type: 'countdown',
  label: 'Countdown',
  group: 'Advanced',
  icon: 'spacer',
  defaultProps: {
    label: 'Offer ends in',
    endsAt: '2026-08-15T23:59:00Z',
    color: '#b91c1c',
    fontSize: 22,
    align: 'center',
    padding: spacing(12, 24),
    backgroundColor: '',
  },
  schema: [
    { key: 'label', type: 'text', label: 'Label', vars: true },
    { key: 'endsAt', type: 'text', label: 'Ends at (ISO)', vars: false },
    { key: 'color', type: 'color', label: 'Colour' },
    { key: 'fontSize', type: 'number', label: 'Size', min: 12, max: 48 },
    { key: 'align', type: 'align', label: 'Align' },
    { key: 'padding', type: 'spacing', label: 'Padding' },
  ],
  render: {
    html(props, ctx) {
      const days = daysLeft(props.endsAt)
      return `<div style="text-align:${props.align};font-family:${ctx.settings.fontFamily}"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${ctx.resolve(props.label)}</div><div style="font-size:${props.fontSize}px;font-weight:bold;color:${props.color}">${days} days</div></div>`
    },
    text(props, ctx) {
      return `${ctx.resolve(props.label)}: ${daysLeft(props.endsAt)} days`
    },
  },
  lint(props) {
    const ends = Date.parse(props.endsAt)
    if (!Number.isFinite(ends)) {
      return [
        {
          id: 'countdown-date',
          level: 'error',
          message: 'Countdown has an unparseable end date.',
          hint: 'Use an ISO 8601 string, e.g. 2026-08-15T23:59:00Z.',
        },
      ]
    }
    if (ends < Date.now()) {
      return [
        {
          id: 'countdown-date',
          level: 'warn',
          message: 'Countdown end date is in the past.',
          hint: 'It will render as "0 days" for every recipient.',
        },
      ]
    }
    return []
  },
})

function daysLeft(endsAt) {
  const ends = Date.parse(endsAt)
  if (!Number.isFinite(ends)) return 0
  return Math.max(0, Math.ceil((ends - Date.now()) / 86400000))
}

// An empty document, so the playground opens on the blank state a real consumer
// sees on a new template. A pre-filled sample would hide it — and hide whether
// starting from nothing actually works.
const starter = normalize(
  createDocument({
    settings: {
      subject: 'Your order is on its way',
      preheader: 'Arriving {{order.eta}} — track it any time',
    },
  }),
)

export function App() {
  const [doc, setDoc] = useState(starter)
  const [lastExport, setLastExport] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MailKiln
          value={doc}
          onChange={setDoc}
          vars={vars}
          blocks={[countdownBlock]}
          // Shows `position` and `usageLimit` without removing anything from the
          // palette — the playground exists to let you try every block.
          tools={{ countdown: { position: 0, usageLimit: 1 } }}
          locale="en"
          onImageUpload={async (file) => {
            // A real app uploads here. The object URL is enough to see the flow.
            await new Promise((resolve) => setTimeout(resolve, 400))
            return URL.createObjectURL(file)
          }}
          onExport={(bundle) => {
            setLastExport(bundle)
            // eslint-disable-next-line no-console
            console.log('exported', bundle)
          }}
        />
      </div>
      {lastExport ? (
        <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
          Exported {Object.keys(lastExport).length} formats — {lastExport.jsx.split('\n').length} lines
          of JSX, {(lastExport.html.length / 1024).toFixed(1)}KB of HTML. See the console.
        </p>
      ) : null}
    </div>
  )
}
