import { OWNERS, type Owner } from './config'
import type { Settings } from './storage'

/**
 * Los dos carriles personales. Ojo: `mine` y `hers` son nombres de carril
 * FIJOS, iguales en los dos móviles — `mine` es siempre el mismo calendario de
 * Google, no "el de quien está mirando". Por eso hace falta `settings.me`:
 * dice cuál de los dos es la persona que ha entrado, y de ahí salen las
 * etiquetas correctas en cada móvil.
 */
export const PERSON_OWNERS = ['mine', 'hers'] as const
export type PersonOwner = (typeof PERSON_OWNERS)[number]

export function isPerson(owner: Owner): owner is PersonOwner {
  return owner !== 'ours'
}

/** El otro de los dos carriles personales. */
export function partnerOf(me: PersonOwner): PersonOwner {
  return me === 'mine' ? 'hers' : 'mine'
}

/**
 * Nombres por defecto, relativos a quien ha entrado. Son los que se usan
 * mientras no se le ponga un nombre propio a cada calendario.
 */
export function defaultOwnerLabels(me: PersonOwner): Record<Owner, string> {
  return {
    [me]: 'Yo',
    [partnerOf(me)]: 'Mi pareja',
    ours: 'Nosotros',
  } as Record<Owner, string>
}

/** Nombre con el que se ve cada calendario: el propio, o el por defecto. */
export function ownerLabels(settings: Settings): Record<Owner, string> {
  const defaults = defaultOwnerLabels(settings.me)
  return Object.fromEntries(
    OWNERS.map((o) => [o, settings.calendars[o]?.label?.trim() || defaults[o]]),
  ) as Record<Owner, string>
}
