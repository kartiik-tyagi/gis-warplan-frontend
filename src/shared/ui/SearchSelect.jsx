import { useEffect, useState } from 'react'
import { Autocomplete, Checkbox, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { createFilterOptions } from '@mui/material/Autocomplete'

const EMPTY = { __empty: true }
const ACTION = { __action: true }

function same(left, right) {
  return String(left ?? '') === String(right ?? '')
}

function defaultLabel(option) {
  if (option == null) return ''
  if (typeof option === 'string' || typeof option === 'number') return String(option)
  return option.name ?? option.label ?? option.title ?? String(option.id ?? '')
}

function defaultValue(option) {
  if (option == null) return ''
  if (typeof option === 'string' || typeof option === 'number') return option
  return option.id ?? option.value ?? option.code ?? ''
}

/**
 * One searchable dropdown for the application.
 * Typing filters the allowed list. A value can be chosen only from that list.
 * `multiple` keeps the same field and shows the chosen items as chips.
 * `clearLabel` adds an explicit empty choice such as "None" or "No side".
 */
export function SearchSelect({
  label,
  options = [],
  value,
  onChange,
  getOptionLabel = defaultLabel,
  getOptionValue = defaultValue,
  multiple = false,
  clearLabel,
  required = false,
  disabled = false,
  error = false,
  helperText,
  size = 'medium',
  fullWidth = true,
  placeholder,
  sx,
  id,
  loading = false,
  noOptionsText = 'No matches',
  isOptionDisabled,
  disableClearable,
  hiddenLabel = false,
  action,
  optionSx,
  'aria-label': ariaLabel,
}) {
  const labelOf = (option) => {
    if (!option || option.__empty) return clearLabel || ''
    if (option.__action) return action?.label || ''
    if (option.__orphan) return String(option.raw ?? '')
    return getOptionLabel(option) ?? ''
  }
  const valueOf = (option) => {
    if (!option || option.__empty) return ''
    if (option.__action) return '__action'
    if (option.__orphan) return option.raw
    return getOptionValue(option)
  }

  const chosenIds = multiple
    ? (Array.isArray(value) ? value : [])
    : (value === '' || value == null ? [] : [value])
  const missing = chosenIds.filter((id) => !options.some((option) => same(valueOf(option), id)))
  const orphans = missing.map((id) => ({ __orphan: true, raw: id }))
  const list = [
    ...(action && !multiple ? [ACTION] : []),
    ...(clearLabel && !multiple ? [EMPTY] : []),
    ...orphans,
    ...options,
  ]

  const selected = multiple
    ? list.filter((option) => !option.__empty && chosenIds.some((id) => same(valueOf(option), id)))
    : list.find((option) => same(valueOf(option), value ?? '')) ?? null

  const filter = createFilterOptions({
    stringify: (option) => (option.__action ? '' : labelOf(option)),
  })

  const canClear = disableClearable ?? (required && !clearLabel)
  const [open, setOpen] = useState(false)
  const shown = !multiple && selected && !selected.__empty && !selected.__action ? labelOf(selected) : ''
  const [inputValue, setInputValue] = useState(shown)
  useEffect(() => {
    if (multiple || open) return
    setInputValue(shown)
  }, [multiple, open, shown])

  return (
    <Autocomplete
      id={id}
      multiple={multiple}
      options={list}
      value={multiple ? selected : (selected ?? null)}
      {...(multiple ? {} : {
        inputValue,
        onInputChange: (_, next, reason) => {
          if (reason === 'input') setInputValue(next)
          else if (reason === 'clear') setInputValue('')
          else if (!open) setInputValue(shown)
        },
      })}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disableClearable={canClear}
      disableCloseOnSelect={multiple}
      blurOnSelect={!multiple}
      autoHighlight
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      openOnFocus={multiple}
      noOptionsText={noOptionsText}
      getOptionLabel={labelOf}
      isOptionEqualToValue={(left, right) => same(valueOf(left), valueOf(right))}
      getOptionDisabled={(option) => Boolean(isOptionDisabled?.(option))}
      filterOptions={(items, state) => {
        const actionItem = items.find((option) => option.__action)
        const filtered = filter(items.filter((option) => !option.__action), state)
        return actionItem ? [actionItem, ...filtered] : filtered
      }}
      onChange={(_, next) => {
        if (next?.__action) {
          setOpen(false)
          setInputValue(shown)
          action?.onSelect?.()
          return
        }
        if (multiple) {
          const picked = (next || []).filter((option) => !option.__empty && !option.__orphan && !option.__action)
          onChange?.(picked.map(valueOf))
          return
        }
        setOpen(false)
        if (!next || next.__empty) onChange?.('')
        else if (!next.__orphan) onChange?.(valueOf(next))
      }}
      renderOption={(props, option, state) => {
        const { key, ...rest } = props
        return (
          <li
            key={key}
            {...rest}
            onMouseDown={(event) => {
              if (!option.__action) {
                rest.onMouseDown?.(event)
                return
              }
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              setInputValue(shown)
              action?.onSelect?.()
            }}
            onClick={(event) => {
              if (option.__action) {
                event.preventDefault()
                event.stopPropagation()
                return
              }
              rest.onClick?.(event)
            }}
            style={option.__action
              ? { ...rest.style, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, borderBottom: '1px solid rgba(127, 127, 127, 0.35)' }
              : rest.style}
          >
            {option.__action ? <AddIcon fontSize="small" /> : null}
            {multiple && !option.__action ? <Checkbox size="small" checked={state.selected} tabIndex={-1} sx={{ mr: 0.75, p: 0.5 }} /> : null}
            {labelOf(option)}
          </li>
        )
      }}
      sx={[
        {
          display: 'flex',
          width: fullWidth ? '100%' : 'auto',
          minWidth: 0,
          '& .MuiFormControl-root': { width: '100%', minWidth: 0 },
          '& .MuiOutlinedInput-root': { width: '100%', minWidth: 0 },
          '& .MuiAutocomplete-input': {
            minWidth: '0 !important',
            flex: '1 1 auto',
            textOverflow: 'ellipsis',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      slotProps={{
        popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 2 } },
        ...(optionSx ? { listbox: { sx: optionSx } } : {}),
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={hiddenLabel ? undefined : label}
          hiddenLabel={hiddenLabel}
          required={required}
          error={error}
          helperText={helperText}
          placeholder={placeholder ?? ''}
          size={size}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps?.htmlInput,
              'aria-label': ariaLabel || (typeof label === 'string' ? label : undefined),
            },
          }}
        />
      )}
    />
  )
}
