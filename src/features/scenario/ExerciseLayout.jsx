import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Tab, Tabs } from '@mui/material'
import { SECTION_ROUTE, sectionFromPath } from '../../shared/auth/access'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { titleCase } from '../../shared/lib/titleCase'
import { headingBandColor } from '../../shared/ui/HeadingRow'
import { scrollbarSx } from '../../shared/ui/scrollbar'
import { useSessionStore } from '../session/useSessionStore'

/** Scrollable page body inside the work window. The map stays mounted behind it. */
export function ExerciseLayout({ actions, children, hideHeader = false }) {
  const refresh = useSessionStore((state) => state.refresh)
  const sections = useSessionStore((state) => state.session?.sections ?? EMPTY_LIST)
  const location = useLocation()
  const navigate = useNavigate()
  const current = sectionFromPath(location.pathname)

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const siblings = useMemo(() => {
    if (!current) return EMPTY_LIST
    const self = sections.find((section) => section.id === current.id)
    if (!self?.kicker) return EMPTY_LIST
    return sections.filter((section) => section.kicker === self.kicker && SECTION_ROUTE[section.id])
  }, [current, sections])

  const showTabs = siblings.length > 1
  const showHeader = !hideHeader && (showTabs || Boolean(actions))

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', ...scrollbarSx }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, py: 2 }}>
          {showHeader ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mx: { xs: -2, sm: -3 },
                mt: -2,
                mb: 2,
                px: { xs: 2, sm: 3 },
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: headingBandColor,
                minHeight: 44,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {showTabs ? (
                  <Tabs
                    value={current?.id || false}
                    onChange={(_, id) => {
                      const route = SECTION_ROUTE[id]
                      if (route) navigate(route)
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      minHeight: 40,
                      '& .MuiTab-root': {
                        minHeight: 40,
                        textTransform: 'none',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        px: 1.5,
                      },
                    }}
                  >
                    {siblings.map((section) => (
                      <Tab key={section.id} value={section.id} label={titleCase(section.label)} />
                    ))}
                  </Tabs>
                ) : null}
              </Box>
              {actions ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                  {actions}
                </Box>
              ) : null}
            </Box>
          ) : null}
          {children}
        </Box>
      </Box>
    </Box>
  )
}
