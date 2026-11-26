/**
 * Top bar only. Set this to true to show the application icon to the left of the name.
 * The login screen and the browser tab are not affected.
 */
export const SHOW_TOPBAR_APPLICATION_ICON = false

/**
 * Words shown before the server has answered, or when it cannot be reached.
 * The title, logo, favicon, and login picture come from the asset store.
 */
export function appUnavailableMessage(detail = 'Try again shortly.') {
  return `The application is unavailable. ${detail}`
}

export function appOpeningLabel() {
  return 'Opening the application'
}

export function appServiceUnreachable() {
  return 'The application service is not reachable.'
}
