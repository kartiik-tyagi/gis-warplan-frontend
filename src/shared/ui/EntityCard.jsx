import { Box, Chip, Stack, Typography } from '@mui/material'

/**
 * Compact two-line list card: title (+ optional chip) on line 1, meta + actions on line 2.
 */
export function EntityCard({
  title,
  chip,
  meta,
  leading,
  actions,
  selected = false,
  onClick,
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 1.5,
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        {leading || null}
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        {chip ? (typeof chip === 'string' ? <Chip size="small" label={chip} color="success" /> : chip) : null}
      </Stack>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ mt: 0.25, minHeight: 28, minWidth: 0 }}
      >
        {meta ? (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
            {meta}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        {actions ? (
          <Stack direction="row" spacing={0} alignItems="center" sx={{ flexShrink: 0 }} onClick={(event) => event.stopPropagation()}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
