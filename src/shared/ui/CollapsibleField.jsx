import { useState } from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

/** Bold caps heading with expand/collapse body — used for scenario narrative fields. */
export function CollapsibleField({ title, defaultOpen = true, children, error = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box
      sx={{
        border: 1,
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.25,
          py: 1,
          border: 0,
          bgcolor: 'action.hover',
          color: 'text.primary',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <IconButton size="small" tabIndex={-1} component="span" sx={{ p: 0.25, color: 'text.secondary' }}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Typography
          component="span"
          sx={{
            flex: 1,
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit={false}>
        <Box sx={{ p: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  )
}
