---
'mailkiln': patch
---

**Two fixes found by building the ejected component for real** — writing it to disk, installing `@react-email/components`, and rendering it.

**The `<title>` shipped its merge variables raw.** `renderToHtml` emitted `settings.subject` unresolved while the preheader ten lines below it went through `ctx.resolve`, so a subject like `Welcome to {{product.name}}` reached the inbox verbatim. The title is now interpolated like every other string in the document.

**An ejected component threw on a prop that arrived incomplete.** The emitted JSX dereferenced merge paths directly — `{product.name}`, `{order.items.map(…)}`, `{user.isPro && …}` — so a single absent optional field failed the whole render with `Cannot read properties of undefined`. Every step after the first is now optional-chained:

```jsx
{user?.name}
{order?.items?.map((item, itemIndex) => …)}
{user?.isPro && (…)}
```

Emails render against live data, where one missing field must not be able to fail a send. Root paths are untouched — they are destructured props and always bound. `conditionExpression` follows the same rule, and its `empty` operator now emits `!path?.length` rather than `path.length === 0`, which also makes it agree with `evaluateCondition`: absent reads as empty.

New: `optionalChain` is exported from `mailkiln/core` for anyone emitting their own expressions.
