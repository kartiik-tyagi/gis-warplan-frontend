/**
 * Brand mark shown next to the product title.
 * The title itself is `warplan.application-name` on the server. These helpers are
 * only the words shown before that title has been read, or when the server cannot be reached.
 */
export const APP_MARK_SRC = '/brand-mark.svg'

export function appUnavailableMessage(detail = 'Try again shortly.') {
  return `The application is unavailable. ${detail}`
}

export function appOpeningLabel() {
  return 'Opening the application'
}

export function appServiceUnreachable() {
  return 'The application service is not reachable.'
}
