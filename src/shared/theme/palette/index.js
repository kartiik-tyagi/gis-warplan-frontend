import { assertContrast } from './check'
import black from './black'
import blue from './blue'
import blue_dark from './blue-dark'
import blue_light from './blue-light'
import green from './green'
import green_dark from './green-dark'
import green_light from './green-light'
import indigo from './indigo'
import orange from './orange'
import red from './red'
import red_dark from './red-dark'
import red_light from './red-light'
import violet from './violet'
import white from './white'
import yellow from './yellow'
import yellow_dark from './yellow-dark'
import yellow_light from './yellow-light'

export const palettes = [
  black,
  blue,
  blue_dark,
  blue_light,
  green,
  green_dark,
  green_light,
  indigo,
  orange,
  red,
  red_dark,
  red_light,
  violet,
  white,
  yellow,
  yellow_dark,
  yellow_light,
]

palettes.forEach(assertContrast)

export function paletteById(id) {
  return palettes.find((item) => item.id === id) || null
}

export const loginPalette = paletteById('blue')
