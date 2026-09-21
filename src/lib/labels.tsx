import { createContext, useContext } from 'react'
import type { Owner } from './config'
import { defaultOwnerLabels, ownerLabels } from './owners'
import type { Settings } from './storage'

/**
 * Nombre visible de cada calendario. Va por contexto porque lo necesitan
 * componentes hondos (el chip de un evento, por ejemplo) y pasarlo como prop
 * por toda la jerarquia solo para esto ensuciaria cuatro firmas.
 */
const LabelsContext = createContext<Record<Owner, string>>(defaultOwnerLabels('mine'))

export function LabelsProvider({
  settings,
  children,
}: {
  settings: Settings
  children: React.ReactNode
}) {
  return <LabelsContext.Provider value={ownerLabels(settings)}>{children}</LabelsContext.Provider>
}

export function useOwnerLabels(): Record<Owner, string> {
  return useContext(LabelsContext)
}

export { ownerLabels }
