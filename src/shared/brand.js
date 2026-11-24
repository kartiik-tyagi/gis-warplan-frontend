/** Product display name. Change this value to rename the app everywhere in the UI. */
export const APP_NAME = 'JAYANT'

export const APP_NAME_UPPER = APP_NAME.toUpperCase()

/**
 * Brand mark shown next to the product name.
 * Replace `public/brand-mark.svg` (or point this path at another file under `/public`) to change it.
 */
export const APP_MARK_SRC = '/brand-mark.svg'

export function appUnavailableMessage(detail = 'Try again shortly.') {
  return `${APP_NAME} is unavailable. ${detail}`
}

export function appOpeningLabel() {
  return `Opening ${APP_NAME}`
}

export function appServiceUnreachable() {
  return `The ${APP_NAME} service is not reachable.`
}

export function exerciseTitleFor(name = APP_NAME) {
  return `Exercise ${name}`
}
