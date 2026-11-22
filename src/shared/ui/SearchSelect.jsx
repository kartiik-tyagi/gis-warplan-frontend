import { useState } from 'react'
import { Autocomplete, Checkbox, TextField } from '@mui/material'
import { createFilterOptions } from '@mui/material/Autocomplete'

const EMPTY = { __empty: true }

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
 * `clearLabel` adds an explicit empty choice such as "None" or "No team".
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
  'aria-label': ariaLabel,
}) {
  const labelOf = (option) => {
    if (!option || option.__empty) return clearLabel || ''
    if (option.__orphan) return String(option.raw ?? '')
    return getOptionLabel(option) ?? ''
  }
  const valueOf = (option) => {
    if (!option || option.__empty) return ''
    if (option.__orphan) return option.raw
    return getOptionValue(option)
  }

  const chosenIds = multiple
    ? (Array.isArray(value) ? value : [])
    : (value === '' || value == null ? [] : [value])
  const missing = chosenIds.filter((id) => !options.some((option) => same(valueOf(option), id)))
  const orphans = missing.map((id) => ({ __orphan: true, raw: id }))
  const list = [
    ...(clearLabel && !multiple ? [EMPTY] : []),
    ...orphans,
    ...options,
  ]

  const selected = multiple
    ? list.filter((option) => !option.__empty && chosenIds.some((id) => same(valueOf(option), id)))
    : list.find((option) => same(valueOf(option), value ?? '')) ?? null

  const filter = createFilterOptions({
    stringify: (option) => labelOf(option),
  })

  const canClear = disableClearable ?? (required && !clearLabel)
  const [open, setOpen] = useState(false)

  return (
    <Autocomplete
      id={id}
      multiple={multiple}
      options={list}
      value={multiple ? selected : (selected ?? null)}
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
      filterOptions={filter}
      onChange={(_, next) => {
        if (multiple) {
          const picked = (next || []).filter((option) => !option.__empty && !option.__orphan)
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
          <li key={key} {...rest}>
            {multiple ? <Checkbox size="small" checked={state.selected} tabIndex={-1} sx={{ mr: 0.75, p: 0.5 }} /> : null}
            {labelOf(option)}
          </li>
        )
      }}
      sx={sx}
      slotProps={{
        popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 2 } },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={hiddenLabel ? undefined : label}
          hiddenLabel={hiddenLabel}
          required={required}
          error={error}
          helperText={helperText}
          placeholder={placeholder || (disabled ? '' : 'Search')}
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
