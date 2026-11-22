import { useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { useSessionStore } from '../session/useSessionStore'

/** Scrollable page body inside the work window. The map stays mounted behind it. */
export function ExerciseLayout({ title, kicker, actions, children }) {
  const refresh = useSessionStore((state) => state.refresh)

  // Keep the top-bar scenario/game dropdowns in sync after creates on these pages.
  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

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
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, py: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              justifyContent: 'space-between',
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              mb: 3,
              pb: 2.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {kicker ? (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ letterSpacing: '0.14em', display: 'block', mb: 0.5 }}
                >
                  {kicker}
                </Typography>
              ) : null}
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}
              >
                {title}
              </Typography>
            </Box>
            {actions ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</Box>
            ) : null}
          </Box>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
