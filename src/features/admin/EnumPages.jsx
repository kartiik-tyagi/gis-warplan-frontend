import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { get, post, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { LoadingState } from '../../shared/ui/LoadingState'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { useToastStore } from '../feedback/useToastStore'

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/

function matches(value, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return String(value || '').toLowerCase().includes(needle)
}

function stickyBack(onClick, disabled) {
  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
      <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={onClick} disabled={disabled} />
    </Box>
  )
}

export function EnumListsPage() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const listed = (await get('/enums')) || EMPTY_LIST
        if (live) setRows(listed)
      } catch (error) {
        if (!live) return
        setRows(EMPTY_LIST)
        push(error?.message || 'The lists could not be loaded.', 'error')
      }
    })()
    return () => {
      live = false
    }
  }, [push])

  const visible = useMemo(() => (rows || EMPTY_LIST).filter((row) => matches(row.label, query)), [rows, query])

  if (!rows) return <LoadingState label="Loading lists" />

  return (
    <ExerciseLayout>
      <Stack spacing={1.25}>
        <TextField label="Find a list" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth size="small" />
        {!visible.length ? (
          <Typography variant="body2" color="text.secondary">
            No lists match.
          </Typography>
        ) : (
          visible.map((row) => (
            <EntityCard
              key={row.key}
              title={row.label}
              actions={
                <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/standard/enums/${row.key}`)} />
              }
            />
          ))
        )}
      </Stack>
    </ExerciseLayout>
  )
}

export function EnumValuesPage() {
  const { list } = useParams()
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [meta, setMeta] = useState(null)
  const [rows, setRows] = useState(null)
  const [sides, setSides] = useState(EMPTY_LIST)
  const [query, setQuery] = useState('')
  const [sideFilter, setSideFilter] = useState('')

  const load = useCallback(async () => {
    const lists = (await get('/enums')) || EMPTY_LIST
    const found = lists.find((item) => item.key === list)
    if (!found) {
      push('The list was not found.', 'error')
      navigate('/standard/enums', { replace: true })
      return
    }
    setMeta(found)
    const values = (await get(`/enums/${list}`)) || EMPTY_LIST
    setRows(values)
    if (found.sideSpecific) {
      const allSides = (await get('/sides')) || EMPTY_LIST
      setSides(allSides.filter((side) => side.kind === 'country'))
    }
  }, [list, navigate, push])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        await load()
      } catch (error) {
        if (!live) return
        push(error?.message || 'The choices could not be loaded.', 'error')
        navigate('/standard/enums', { replace: true })
      }
    })()
    return () => {
      live = false
    }
  }, [load, push])

  const visible = useMemo(() => {
    return (rows || EMPTY_LIST).filter((row) => {
      if (sideFilter && String(row.sideId) !== sideFilter) return false
      return matches(row.label, query)
    })
  }, [rows, query, sideFilter])

  if (!rows || !meta) return <LoadingState label="Loading choices" />

  const openNew = () => {
    const search = sideFilter ? `?sideId=${sideFilter}` : ''
    navigate(`/standard/enums/${list}/new${search}`)
  }

  return (
    <ExerciseLayout actions={<CreateAction label="New value" onClick={openNew} />}>
      <Stack spacing={1.25}>
        {stickyBack(() => navigate('/standard/enums'))}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {meta.label}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {meta.sideSpecific ? (
            <TextField select label="Side" value={sideFilter} onChange={(event) => setSideFilter(event.target.value)} size="small" sx={{ minWidth: 180 }}>
              <MenuItem value="">All sides</MenuItem>
              {sides.map((side) => (
                <MenuItem key={side.id} value={String(side.id)}>
                  {side.name}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField label="Find a value" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth size="small" />
        </Stack>
        {!rows.length ? (
          <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              No choices yet
            </Typography>
            <CreateAction label="New value" onClick={openNew} />
          </Box>
        ) : !visible.length ? (
          <Typography variant="body2" color="text.secondary">
            No choices match.
          </Typography>
        ) : (
          visible.map((row) => (
            <EntityCard
              key={`${row.code}-${row.sideId || ''}`}
              title={row.label}
              chip={meta.sideSpecific && row.sideName ? <Chip size="small" variant="outlined" label={row.sideName} /> : null}
              actions={
                <IconAction
                  label="Edit"
                  icon={<EditOutlinedIcon fontSize="small" />}
                  onClick={() => {
                    const search = row.sideId ? `?sideId=${row.sideId}` : ''
                    navigate(`/standard/enums/${list}/${row.code}${search}`)
                  }}
                />
              }
            />
          ))
        )}
      </Stack>
    </ExerciseLayout>
  )
}

export function EnumEditorPage() {
  const { list, code: pathCode } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !pathCode || pathCode === 'new'
  const openedSide = searchParams.get('sideId') || ''
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState(null)
  const [sides, setSides] = useState(EMPTY_LIST)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [order, setOrder] = useState('0')
  const [available, setAvailable] = useState(true)
  const [sideId, setSideId] = useState(openedSide)
  const [locatedSide, setLocatedSide] = useState(openedSide)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const lists = (await get('/enums')) || EMPTY_LIST
        const found = lists.find((item) => item.key === list)
        if (!found) {
          push('The list was not found.', 'error')
          navigate('/standard/enums', { replace: true })
          return
        }
        if (!live) return
        setMeta(found)
        if (found.sideSpecific) {
          const allSides = (await get('/sides')) || EMPTY_LIST
          if (!live) return
          setSides(allSides.filter((side) => side.kind === 'country'))
        }
        if (!isNew) {
          const query = openedSide ? { sideId: openedSide } : undefined
          const row = await get(`/enums/${list}/${pathCode}`, query)
          if (!live) return
          setCode(row.code || '')
          setLabel(row.label || '')
          setOrder(String(row.sortOrder ?? 0))
          setAvailable(Boolean(row.active))
          setSideId(row.sideId ? String(row.sideId) : '')
          setLocatedSide(row.sideId ? String(row.sideId) : '')
        }
        if (live) setReady(true)
      } catch (error) {
        if (!live) return
        push(error?.message || 'The choice could not be opened.', 'error')
        navigate(`/standard/enums/${list}`, { replace: true })
      }
    })()
    return () => {
      live = false
    }
  }, [isNew, list, navigate, openedSide, pathCode, push])

  const back = () => navigate(`/standard/enums/${list}`)

  const save = async () => {
    const next = {}
    const storedCode = code.trim().toUpperCase()
    if (isNew && !CODE_PATTERN.test(storedCode)) next.code = 'Use letters, digits, and underscores, starting with a letter.'
    if (!label.trim()) next.label = 'Enter a label.'
    else if (label.trim().length > 120) next.label = 'Use at most 120 characters.'
    const parsedOrder = Number(order)
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0 || parsedOrder > 10000) next.sortOrder = 'Enter a number from 0 to 10000.'
    if (meta?.sideSpecific && !sideId) next.sideId = 'Choose a side.'
    setErrors(next)
    if (Object.keys(next).length) {
      setBanner('Fix the highlighted fields before saving.')
      return
    }
    setBusy(true)
    setBanner('')
    const body = {
      code: isNew ? storedCode : code,
      label: label.trim(),
      sortOrder: parsedOrder,
      active: available,
      sideId: meta?.sideSpecific ? Number(sideId) : null,
    }
    try {
      if (isNew) {
        await post(`/enums/${list}`, body)
        logger.info('enum.created', { list, code: storedCode })
        push('Choice created.', 'success')
      } else {
        const query = locatedSide ? { sideId: locatedSide } : undefined
        await put(`/enums/${list}/${pathCode}`, body, { query })
        logger.info('enum.updated', { list, code: pathCode })
        push('Choice saved.', 'success')
      }
      navigate(`/standard/enums/${list}`, { replace: true })
    } catch (error) {
      const fieldErrors = error?.fieldErrors || {}
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      setBanner(error?.message || 'The choice could not be saved.')
      push(error?.message || 'The choice could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!ready || !meta) return <LoadingState label="Opening choice" />

  return (
    <ExerciseLayout>
      <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
        {stickyBack(back, busy)}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {meta.label}
        </Typography>
        {banner ? <Alert severity="error">{banner}</Alert> : null}
        <TextField
          label="Code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          disabled={!isNew || busy}
          required
          fullWidth
          error={Boolean(errors.code)}
          helperText={errors.code || ' '}
        />
        <TextField
          label="Label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          disabled={busy}
          required
          fullWidth
          error={Boolean(errors.label)}
          helperText={errors.label || ' '}
        />
        <TextField
          label="Order in the list"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          disabled={busy}
          required
          fullWidth
          type="number"
          error={Boolean(errors.sortOrder)}
          helperText={errors.sortOrder || 'A smaller number appears higher in the dropdown. The number itself is not shown there.'}
        />
        {meta.sideSpecific ? (
          <TextField
            select
            label="Side"
            value={sideId}
            onChange={(event) => setSideId(event.target.value)}
            disabled={busy}
            required
            fullWidth
            error={Boolean(errors.sideId)}
            helperText={errors.sideId || ' '}
          >
            {sides.map((side) => (
              <MenuItem key={side.id} value={String(side.id)}>
                {side.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <FormControlLabel
          control={<Checkbox checked={available} onChange={(event) => setAvailable(event.target.checked)} disabled={busy} />}
          label="Available as a choice"
        />
        <Typography variant="caption" color="text.secondary">
          On, this choice appears in dropdowns. Off, it stays here and is left out of those dropdowns. Anything already using it keeps it.
        </Typography>
        <IconAction
          label={busy ? 'Saving…' : isNew ? 'Create value' : 'Save value'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          disabled={busy}
          onClick={save}
          variant="contained"
        />
      </Stack>
    </ExerciseLayout>
  )
}
