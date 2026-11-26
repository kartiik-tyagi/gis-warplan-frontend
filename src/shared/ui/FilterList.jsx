import { useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { useCommit, useDirectoryStore } from '../../features/directory/useDirectoryStore'
import { useSessionStore } from '../../features/session/useSessionStore'
import * as api from '../../shared/api/client'
import { EMPTY_LIST, EMPTY_OBJECT } from '../lib/empty'
import { ACTIVE_WMS_BUDGET, countActiveWms, wouldExceedBudget } from '../map/renderUnits'
import { IconAction } from './IconAction'
import { useToastStore } from '../../features/feedback/useToastStore'

function groupVisibilityState(filter) {
  if (filter.kind !== 'group') return filter.visible ? 'all' : 'none'
  const members = filter.members || []
  if (!members.length) return filter.visible ? 'all' : 'none'
  const on = members.filter((member) => member.visible).length
  if (on === 0) return 'none'
  if (on === members.length && filter.renderMode !== 'members') return 'all'
  if (on === members.length) return 'all'
  return 'mixed'
}

export function FilterList() {
  const filters = useSessionStore((state) => state.session?.filters ?? EMPTY_LIST)
  const setFilter = useSessionStore((state) => state.setFilter)
  const setMemberFilter = useSessionStore((state) => state.setMemberFilter)
  const setAllFilters = useSessionStore((state) => state.setAllFilters)
  const opacity = useDirectoryStore((state) => state.data?.opacity ?? EMPTY_OBJECT)
  const opacityEnabled = useDirectoryStore((state) => state.data?.flags?.layerOpacity !== false)
  const commit = useCommit()
  const push = useToastStore((state) => state.push)
  const [expanded, setExpanded] = useState(() => new Set())

  const activeWms = useMemo(() => countActiveWms(filters), [filters])
  const shown = filters.filter((filter) => filter.visible || (filter.members || []).some((m) => m.visible)).length
  const hidden = filters.length - shown

  const toggleExpanded = (id) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const trySetFilter = (id, visible) => {
    const next = filters.map((filter) => {
      if (filter.id !== id) return filter
      if (filter.kind === 'group') {
        return {
          ...filter,
          visible,
          renderMode: 'group',
          members: (filter.members || []).map((member) => ({ ...member, visible })),
        }
      }
      return { ...filter, visible }
    })
    if (visible && wouldExceedBudget(filters, next)) {
      push(`Too many single layers on the map (max ${ACTIVE_WMS_BUDGET}). Turn on a whole group instead.`, 'warning')
      return
    }
    setFilter(id, visible)
  }

  const trySetMember = (groupId, memberId, visible) => {
    const next = filters.map((filter) => {
      if (filter.id !== groupId || filter.kind !== 'group') return filter
      const members = (filter.members || []).map((member) =>
        member.id === memberId ? { ...member, visible } : member,
      )
      const onCount = members.filter((member) => member.visible).length
      return {
        ...filter,
        members,
        visible: onCount > 0,
        renderMode: onCount === members.length ? 'group' : 'members',
      }
    })
    if (visible && wouldExceedBudget(filters, next)) {
      push(`Too many single layers on the map (max ${ACTIVE_WMS_BUDGET}). Keep the whole group on, or turn some off.`, 'warning')
      return
    }
    setMemberFilter(groupId, memberId, visible)
  }

  if (!filters.length) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4, px: 2, textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <LayersOutlinedIcon />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
          No layers available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No layers.
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.hover',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <LayersOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 650, lineHeight: 1.3 }}>
            Map Filters
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip size="small" icon={<VisibilityOutlinedIcon />} color={shown ? 'primary' : 'default'} variant={shown ? 'filled' : 'outlined'} label={`${shown} shown`} />
        <Chip size="small" icon={<VisibilityOffOutlinedIcon />} variant="outlined" label={`${hidden} hidden`} />
        <Chip size="small" variant="outlined" label={`Active WMS ${activeWms}/${ACTIVE_WMS_BUDGET}`} />
        <Box sx={{ flex: 1, minWidth: 8 }} />
        <IconAction label="Show all" icon={<VisibilityOutlinedIcon fontSize="small" />} onClick={() => setAllFilters(true)} />
        <IconAction label="Hide all" icon={<VisibilityOffOutlinedIcon fontSize="small" />} onClick={() => setAllFilters(false)} />
        <IconAction
          label="Expand all"
          icon={<ExpandMoreIcon fontSize="small" />}
          onClick={() => setExpanded(new Set(filters.map((filter) => filter.id)))}
        />
        <IconAction label="Collapse all" icon={<ChevronRightIcon fontSize="small" />} onClick={() => setExpanded(new Set())} />
      </Stack>

      <Stack spacing={0.75}>
        {filters.map((filter) => {
          const open = expanded.has(filter.id)
          const state = groupVisibilityState(filter)
          const isGroup = filter.kind === 'group'
          const memberCount = filter.members?.length || 0
          const onCount = isGroup
            ? (filter.members || []).filter((member) => member.visible).length
            : filter.visible
              ? 1
              : 0

          return (
            <Box
              key={filter.id}
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
              }}
            >
              <Stack direction="row" alignItems="center" sx={{ pr: 1, bgcolor: 'action.hover' }}>
                <ListItemButton
                  onClick={() => (isGroup || filter.kind === 'layer' ? toggleExpanded(filter.id) : null)}
                  aria-expanded={open}
                  sx={{ py: 0.75, minHeight: 40, flex: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                    {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={filter.label}
                    secondary={isGroup ? `${onCount}/${memberCount} on` : filter.visible ? 'Visible' : 'Hidden'}
                    slotProps={{
                      primary: { variant: 'body2', sx: { fontWeight: 650 } },
                      secondary: { variant: 'caption' },
                    }}
                  />
                </ListItemButton>
                <Checkbox
                  size="small"
                  checked={state === 'all'}
                  indeterminate={state === 'mixed'}
                  onChange={(event) => trySetFilter(filter.id, event.target.checked)}
                  inputProps={{ 'aria-label': `${filter.label} visibility` }}
                />
                <Switch
                  size="small"
                  checked={state !== 'none'}
                  onChange={(event) => trySetFilter(filter.id, event.target.checked)}
                  inputProps={{ 'aria-label': `${filter.label} switch` }}
                />
              </Stack>

              <Collapse in={open} timeout="auto" unmountOnExit>
                <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
                  {isGroup
                    ? (filter.members || []).map((member) => {
                        const value = opacity[member.id] ?? member.opacity ?? 1
                        return (
                          <Box key={member.id} sx={{ px: 1.5, py: 1, pl: 4.5, bgcolor: member.visible ? 'action.selected' : 'transparent' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: member.visible ? 650 : 500 }}>
                                  {member.label}
                                </Typography>
                              </Box>
                              <Checkbox
                                size="small"
                                checked={Boolean(member.visible)}
                                onChange={(event) => trySetMember(filter.id, member.id, event.target.checked)}
                                inputProps={{ 'aria-label': `${member.label} visibility` }}
                              />
                              <Switch
                                size="small"
                                checked={Boolean(member.visible)}
                                onChange={(event) => trySetMember(filter.id, member.id, event.target.checked)}
                              />
                            </Stack>
                            {opacityEnabled && member.visible ? (
                              <Slider
                                size="small"
                                min={0.15}
                                max={1}
                                step={0.05}
                                value={value}
                                sx={{ mt: 1 }}
                                onChangeCommitted={(_, next) =>
                                  commit((userId) => api.setLayerOpacity(userId, member.id, next))
                                }
                              />
                            ) : null}
                          </Box>
                        )
                      })
                    : (
                      <Box sx={{ px: 1.5, py: 1, pl: 4.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {filter.layers}
                        </Typography>
                        {opacityEnabled && filter.visible ? (
                          <Slider
                            size="small"
                            min={0.15}
                            max={1}
                            step={0.05}
                            value={opacity[filter.id] ?? filter.opacity ?? 1}
                            sx={{ mt: 1 }}
                            onChangeCommitted={(_, next) =>
                              commit((userId) => api.setLayerOpacity(userId, filter.id, next))
                            }
                          />
                        ) : null}
                      </Box>
                      )}
                </Stack>
              </Collapse>
            </Box>
          )
        })}
      </Stack>
    </Stack>
  )
}
