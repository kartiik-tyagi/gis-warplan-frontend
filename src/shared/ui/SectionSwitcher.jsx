import { useMemo, useState } from 'react'
import { Box, ButtonBase, Collapse, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { SECTION_ROUTE } from '../auth/access'
import { useSections } from '../../features/session/useSections'
import { NavIcon } from './navIcons'
import { titleCase } from '../lib/titleCase'

function groupByKicker(sections) {
  const groups = []
  let current = null
  sections.forEach((section) => {
    if (!current || current.kicker !== section.kicker) {
      current = { kicker: section.kicker, items: [] }
      groups.push(current)
    }
    current.items.push(section)
  })
  return groups
}

/**
 * Work-window title control: switch section groups and items while a form is open.
 * Dock-only sections (e.g. ORBAT) are listed too.
 */
export function SectionSwitcher({ currentId, title }) {
  const { sections, select } = useSections()
  const [anchor, setAnchor] = useState(null)
  const groups = useMemo(() => groupByKicker(sections), [sections])
  const [openKickers, setOpenKickers] = useState(() => new Set())

  const activeKicker = useMemo(() => {
    const match = sections.find((section) => section.id === currentId)
    return match?.kicker || title
  }, [sections, currentId, title])

  const openMenu = (event) => {
    event.stopPropagation()
    const match = sections.find((section) => section.id === currentId)
    setOpenKickers(match?.kicker ? new Set([match.kicker]) : new Set(groups.map((group) => group.kicker)))
    setAnchor(event.currentTarget)
  }

  const toggleKicker = (kicker) => {
    setOpenKickers((prev) => {
      const next = new Set(prev)
      if (next.has(kicker)) next.delete(kicker)
      else next.add(kicker)
      return next
    })
  }

  const choose = (id) => {
    select(id)
    setAnchor(null)
  }

  return (
    <>
      <ButtonBase
        id="work-window-title"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={openMenu}
        onPointerDown={(event) => event.stopPropagation()}
        sx={{
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          gap: 0.5,
          px: 0.5,
          py: 0.25,
          borderRadius: 1,
          textAlign: 'left',
        }}
      >
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
          {titleCase(activeKicker || title)}
        </Typography>
        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 420 } } }}
      >
        {groups.map((group) => {
          const expanded = openKickers.has(group.kicker)
          return (
            <Box key={group.kicker}>
              <Box
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  toggleKicker(group.kicker)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleKicker(group.kicker)
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  py: 0.75,
                  minHeight: 36,
                  cursor: 'pointer',
                  typography: 'overline',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                  {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </ListItemIcon>
                {titleCase(group.kicker)}
              </Box>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                {group.items.map((section) => (
                  <MenuItem
                    key={section.id}
                    selected={section.id === currentId}
                    onClick={() => choose(section.id)}
                    sx={{ pl: 4 }}
                  >
                    <ListItemIcon sx={{ color: section.id === currentId ? 'primary.main' : 'text.secondary' }}>
                      <NavIcon name={section.icon} />
                    </ListItemIcon>
                    <ListItemText primary={titleCase(section.label)} />
                    {!SECTION_ROUTE[section.id] ? (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        Dock
                      </Typography>
                    ) : null}
                  </MenuItem>
                ))}
              </Collapse>
            </Box>
          )
        })}
      </Menu>
    </>
  )
}
