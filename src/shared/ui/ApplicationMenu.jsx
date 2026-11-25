import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'
import { useSections } from '../../features/session/useSections'
import { NavIcon } from './navIcons'
import { scrollbarSx } from './scrollbar'

function ItemButton({ section, selected, expanded, onSelect, placement }) {
  const button = (
    <ListItemButton
      selected={selected}
      aria-label={section.label}
      aria-pressed={selected}
      onClick={() => onSelect(section.id)}
      sx={{
        minHeight: 40,
        px: expanded ? 1.5 : 0,
        mx: 0.5,
        borderRadius: 1,
        justifyContent: expanded ? 'flex-start' : 'center',
        color: 'text.primary',
        '&.Mui-selected': { bgcolor: 'action.selected', color: 'text.primary' },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: expanded ? 32 : 0,
          color: selected ? 'primary.main' : 'text.secondary',
          justifyContent: 'center',
        }}
      >
        <NavIcon name={section.icon} />
      </ListItemIcon>
      {expanded ? <ListItemText primary={section.label} slotProps={{ primary: { variant: 'body2', noWrap: true } }} /> : null}
    </ListItemButton>
  )
  if (expanded) return button
  return (
    <Tooltip title={section.label} placement={placement}>
      {button}
    </Tooltip>
  )
}

function groupSections(sections) {
  const groups = []
  let current = null
  sections.forEach((section) => {
    if (!current || current.header !== section.kicker) {
      current = { header: section.kicker, items: [] }
      groups.push(current)
    }
    current.items.push(section)
  })
  return groups
}

function PopupMenuGroups({ sections, sectionId, onSelect }) {
  const groups = useMemo(() => groupSections(sections), [sections])
  const [openGroups, setOpenGroups] = useState(() => new Set())

  useEffect(() => {
    if (!sectionId) return
    const match = groups.find((group) => group.items.some((item) => item.id === sectionId))
    if (!match) return
    setOpenGroups((prev) => {
      if (prev.has(match.header)) return prev
      const next = new Set(prev)
      next.add(match.header)
      return next
    })
  }, [groups, sectionId])

  const toggle = (header) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(header)) next.delete(header)
      else next.add(header)
      return next
    })
  }

  if (!sections.length) {
    return <MenuItem disabled>No application sections for this role</MenuItem>
  }

  return groups.map((group) => {
    const expanded = openGroups.has(group.header)
    return (
      <Box key={group.header} sx={{ display: 'block' }}>
        <Box sx={{ px: 1, py: 0.25 }}>
        <ListItemButton
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggle(group.header)
          }}
          aria-expanded={expanded}
          sx={{
            width: 'fit-content',
            maxWidth: '100%',
            minHeight: 32,
            py: 0.5,
            px: 0.75,
            borderRadius: 1,
            typography: 'overline',
            letterSpacing: '0.08em',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={group.header}
            slotProps={{ primary: { variant: 'overline', sx: { letterSpacing: '0.08em', fontWeight: 600 } } }}
          />
        </ListItemButton>
        </Box>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box>
            {group.items.map((section) => (
              <MenuItem
                key={section.id}
                selected={section.id === sectionId}
                onClick={() => onSelect(section.id)}
                sx={{ width: 'fit-content', maxWidth: 'calc(100% - 16px)', mx: 1, my: 0.25, pl: 1.5, borderRadius: 1 }}
              >
                <ListItemIcon sx={{ color: section.id === sectionId ? 'primary.main' : 'text.secondary' }}>
                  <NavIcon name={section.icon} />
                </ListItemIcon>
                {section.label}
              </MenuItem>
            ))}
          </Box>
        </Collapse>
      </Box>
    )
  })
}

export function ApplicationMenu({ presentation = 'rail', expanded = false, onExpandedChange, onHide, edge = 'start' }) {
  const { sections, sectionId, select } = useSections()
  const [anchor, setAnchor] = useState(null)

  if (presentation === 'menu') {
    return (
      <>
        <Tooltip title="Application menu">
          <IconButton
            aria-label="Application menu"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          slotProps={{
            paper: {
              sx: {
                maxHeight: 'min(70vh, 480px)',
                overflowY: 'auto',
                ...scrollbarSx,
              },
            },
            list: {
              sx: {
                py: 0.5,
                maxHeight: 'inherit',
                overflowY: 'auto',
                ...scrollbarSx,
              },
            },
          }}
        >
          <PopupMenuGroups
            sections={sections}
            sectionId={sectionId}
            onSelect={(id) => {
              select(id)
              setAnchor(null)
            }}
          />
        </Menu>
      </>
    )
  }

  if (presentation === 'bar' || presentation === 'icons') {
    return (
      <Box
        component="nav"
        aria-label="Application"
        sx={{
          minHeight: 40,
          px: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          overflowX: 'auto',
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          ...scrollbarSx,
        }}
      >
        {sections.map((section) => {
          const selected = section.id === sectionId
          if (presentation === 'icons') {
            return (
              <Tooltip key={section.id} title={section.label}>
                <IconButton aria-label={section.label} aria-pressed={selected} color={selected ? 'primary' : 'default'} onClick={() => select(section.id)}>
                  <NavIcon name={section.icon} />
                </IconButton>
              </Tooltip>
            )
          }
          return (
            <Button
              key={section.id}
              aria-pressed={selected}
              onClick={() => select(section.id)}
              sx={{
                flexShrink: 0,
                borderRadius: 0,
                textTransform: 'none',
                color: selected ? 'text.primary' : 'text.secondary',
                borderBottom: 2,
                borderColor: selected ? 'primary.main' : 'transparent',
              }}
            >
              {section.label}
            </Button>
          )
        })}
        {onHide ? (
          <Tooltip title="Hide application menu">
            <IconButton aria-label="Hide application menu" onClick={onHide} sx={{ ml: 'auto' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    )
  }

  const width = expanded ? 248 : 56
  return (
    <Box
      component="nav"
      aria-label="Application"
      sx={{
        width,
        flexShrink: 0,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        borderRight: edge === 'start' ? 1 : 0,
        borderLeft: edge === 'end' ? 1 : 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: expanded ? 'flex-end' : 'center', flexShrink: 0 }}>
        {onHide ? (
          <Tooltip title="Hide application menu">
            <IconButton aria-label="Hide application menu" onClick={onHide}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title={expanded ? 'Collapse application menu' : 'Expand application menu'}>
          <IconButton
            aria-label={expanded ? 'Collapse application menu' : 'Expand application menu'}
            onClick={() => onExpandedChange?.(!expanded)}
          >
            {expanded ? <ChevronLeftIcon sx={{ transform: edge === 'end' ? 'rotate(180deg)' : 'none' }} /> : <MenuIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ overflow: 'auto', flex: 1, pb: 1, ...scrollbarSx }}>
        {sections.map((section) => (
          <ItemButton
            key={section.id}
            section={section}
            selected={section.id === sectionId}
            expanded={expanded}
            onSelect={select}
            placement={edge === 'end' ? 'left' : 'right'}
          />
        ))}
      </Box>
    </Box>
  )
}
