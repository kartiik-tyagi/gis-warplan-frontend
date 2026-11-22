import { Box, Divider, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { PanelBody } from './workbench/Panels'

const TITLES = {
  filters: 'Map Filters',
  orbat: 'ORBAT',
  'scenario-admin': 'Scenario Management',
  'game-admin': 'Game',
}

export function ToolPanel({ panel, onClose }) {
  if (!panel) return null

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      {panel === 'filters' ? null : (
        <>
          <Box sx={{ minHeight: 48, px: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {TITLES[panel] || 'Panel'}
            </Typography>
            <IconButton aria-label="Close panel" onClick={onClose} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Divider />
        </>
      )}
      {panel === 'filters' ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 0.75, pb: 0 }}>
          <IconButton aria-label="Close panel" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : null}
      <Box
        sx={{
          overflow: 'auto',
          px: { xs: 1.25, sm: 1.75 },
          py: 1.5,
          flex: 1,
          minHeight: 0,
          pt: panel === 'filters' ? 0.5 : 1.5,
          ...(panel === 'filters'
            ? {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': { display: 'none', width: 0, height: 0 },
              }
            : null),
        }}
      >
        <PanelBody panel={panel} />
      </Box>
    </Box>
  )
}
