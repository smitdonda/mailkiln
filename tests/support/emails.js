/**
 * Sample source emails for the importer specs.
 *
 * Written here rather than as fixture files because each one exists to exercise
 * a specific shape, and the shape is easier to see next to the assertion than in
 * a separate hundred-line document.
 *
 * @module tests/support/emails
 */

/** A table-based export with Mailchimp merge tags, a preheader and a two-up row. */
export const mailchimpish = `<!doctype html>
<html lang="en">
<head><title>Sale time</title><style>@media only screen and (max-width:600px){.c{width:100%}}</style></head>
<body bgcolor="#f0f0f0" style="background-color:#f0f0f0;font-family:Georgia, serif;color:#222222">
  <div style="display:none;max-height:0;overflow:hidden">Preview line here</div>
  <table width="600" align="center">
    <tr><td>
      <table width="100%">
        <tr><td><h1 style="font-size:30px">Hi *|FNAME|*</h1></td></tr>
        <tr><td><p>Your city is *|MERGE:CITY|*.</p></td></tr>
        <tr><td width="50%">Left column</td><td width="50%">Right column</td></tr>
        <tr><td><a href="https://x.test" style="background-color:#ff0000;padding:12px 24px;color:#ffffff">Shop now</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

/** No layout tables at all — the div-based shape a modern builder emits. */
export const divBased = `<html><body>
  <div>
    <div style="font-size:16px">A div-based email with no tables anywhere.</div>
    <div><img src="/relative.png" alt="Logo"></div>
  </div>
</body></html>`

/** A column holding a nested layout table, which has no schema representation. */
export const nestedLayout = `<html><body>
  <table width="600" align="center"><tr><td>
    <table width="100%"><tr>
      <td width="50%"><table><tr><td>A</td><td>B</td></tr></table></td>
      <td width="50%">Plain copy in the other column</td>
    </tr></table>
  </td></tr></table>
</body></html>`

/** Nothing an inference pass can hold on to. */
export const unstructured = '<html><body>&nbsp;</body></html>'
