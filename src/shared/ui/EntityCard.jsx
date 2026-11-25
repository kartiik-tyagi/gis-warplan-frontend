import { Box, Chip, Stack, Typography } from '@mui/material'

/**
 * List row. With no meta, the name and icons share one line. A long name ellipsizes.
 * `active` paints the whole row green and does not add an Active label.
 */
export function EntityCard({
  title,
  chip,
  meta,
  leading,
  actions,
  selected = false,
  active = false,
  onClick,
}) {
  const oneLine = !meta
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1,
        py: oneLine ? 0.25 : 0.75,
        borderRadius: 1.5,
        border: 1,
        borderColor: active ? 'success.dark' : selected ? 'primary.main' : 'divider',
        bgcolor: active ? 'success.main' : 'background.paper',
        color: active ? 'success.contrastText' : 'text.primary',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, height: oneLine ? 40 : undefined }}>
        {leading || null}
        <Typography
          variant="subtitle2"
          noWrap
          title={typeof title === 'string' ? title : undefined}
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            height: oneLine ? '100%' : undefined,
            color: 'inherit',
          }}
        >
          {title}
        </Typography>
        {chip ? (typeof chip === 'string' ? <Chip size="small" label={chip} color="success" /> : chip) : null}
        {oneLine && actions ? (
          <Stack
            direction="row"
            spacing={0}
            alignItems="center"
            sx={{ flexShrink: 0, color: 'inherit', '& .MuiIconButton-colorInherit, & .MuiIconButton-root:not(.MuiIconButton-colorError):not(.MuiIconButton-colorPrimary)': { color: 'inherit' } }}
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {oneLine ? null : (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, minHeight: 28, minWidth: 0 }}>
          <Typography variant="caption" color={active ? 'inherit' : 'text.secondary'} noWrap sx={{ flex: 1, minWidth: 0 }}>
            {meta}
          </Typography>
          {actions ? (
            <Stack direction="row" spacing={0} alignItems="center" sx={{ flexShrink: 0 }} onClick={(event) => event.stopPropagation()}>
              {actions}
            </Stack>
          ) : null}
        </Stack>
      )}
    </Box>
  )
}
