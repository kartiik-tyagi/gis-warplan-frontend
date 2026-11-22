import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SECTION_PANEL, SECTION_ROUTE, sectionFromPath } from '../../shared/auth/access'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { useChromeBus } from './useChromeBus'
import { useSessionStore } from './useSessionStore'

export function useSections() {
  const sections = useSessionStore((state) => state.session?.sections ?? EMPTY_LIST)
  const openPanel = useChromeBus((state) => state.open)
  const dismissDock = useChromeBus((state) => state.dismissDock)
  const navigate = useNavigate()
  const location = useLocation()
  const [dockSection, setDockSection] = useState(null)
  const routeSection = sectionFromPath(location.pathname)
  const selected = routeSection && sections.some((section) => section.id === routeSection.id)
    ? routeSection.id
    : sections.some((section) => section.id === dockSection)
      ? dockSection
      : null

  const select = (id) => {
    const route = SECTION_ROUTE[id]
    if (route) {
      setDockSection(null)
      dismissDock()
      navigate(route)
      return
    }
    const panel = SECTION_PANEL[id]
    if (!panel) return
    setDockSection(id)
    openPanel(panel)
    if (location.pathname !== '/') navigate('/')
  }

  return { sections, sectionId: selected, select }
}
