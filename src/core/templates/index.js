/**
 * Starter templates.
 *
 * @module mailforge/core/templates
 */

import {
  newsletterTemplate,
  passwordResetTemplate,
  receiptTemplate,
  welcomeTemplate,
} from './builtin.js'

/**
 * @typedef {object} TemplateDef
 * @property {string} id
 * @property {string} name
 * @property {string} description One line, shown under the name in the gallery.
 * @property {boolean} [transactional] Triggered by a user action rather than sent in a campaign.
 * @property {() => import('../types.js').EmailDocument} create Returns a *fresh*
 *   document each call, so picking the same template twice cannot produce
 *   duplicate node ids.
 */

/** @type {TemplateDef[]} */
export const builtinTemplates = [
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Onboarding email with a primary action and two next steps.',
    create: welcomeTemplate,
  },
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'Order confirmation with line items and a total.',
    transactional: true,
    create: receiptTemplate,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Lead image, standfirst and a two-up story grid.',
    create: newsletterTemplate,
  },
  {
    id: 'password-reset',
    name: 'Password reset',
    description: 'Short transactional email with an expiring link.',
    transactional: true,
    create: passwordResetTemplate,
  },
]

/**
 * @param {string} id
 * @returns {TemplateDef | undefined}
 */
export function getTemplate(id) {
  return builtinTemplates.find((template) => template.id === id)
}

export { welcomeTemplate, receiptTemplate, newsletterTemplate, passwordResetTemplate }
