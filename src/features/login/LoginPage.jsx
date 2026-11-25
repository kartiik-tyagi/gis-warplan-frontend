import { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLoginContext, login } from '../../shared/api/client'
import { appOpeningLabel, appUnavailableMessage } from '../../shared/brand'
import { ErrorState } from '../../shared/ui/ErrorState'
import { LoadingState } from '../../shared/ui/LoadingState'
import { PasswordField } from '../../shared/ui/PasswordField'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { useSessionStore } from '../session/useSessionStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const signIn = useSessionStore((state) => state.signIn)
  const notice = useSessionStore((state) => state.notice)
  const clearNotice = useSessionStore((state) => state.clearNotice)
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const context = useQuery({ queryKey: ['login-context'], queryFn: getLoginContext })

  useEffect(() => {
    document.title = context.data?.applicationName || 'Application'
    const icon = context.data?.faviconUrl
    if (!icon) return undefined
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = icon
    return undefined
  }, [context.data?.applicationName, context.data?.faviconUrl])

  useEffect(() => {
    const first = context.data?.users?.[0]?.id
    if (first && !userId) setUserId(first)
  }, [context.data, userId])

  const attempt = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      signIn(session)
      navigate('/')
    },
  })

  if (context.isPending) return <LoadingState label={appOpeningLabel()} />

  if (context.isError) {
    return (
      <Box sx={{ p: 3, maxWidth: 560 }}>
        <ErrorState title="The application is unavailable" message={context.error.message} onRetry={() => context.refetch()} />
      </Box>
    )
  }

  const data = context.data

  const picture = data.loginBackgroundUrl || data.backgroundImage
  return (
    <Box
      sx={(theme) => ({
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: 'text.primary',
        bgcolor: picture ? 'transparent' : 'background.default',
        backgroundImage: picture ? `url(${picture})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      })}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: { xs: 'center', md: 'flex-end' },
          px: { xs: 2, md: 6 },
          py: 3,
        }}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault()
            clearNotice()
            attempt.mutate({ userId, password })
          }}
          sx={{
            width: 'min(400px, 100%)',
            p: { xs: 2.5, sm: 3 },
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
            border: 1,
            borderColor: 'divider',
            boxShadow: 8,
          }}
        >
          <Stack spacing={2.5}>
            <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <Typography variant="h5" component="h1">
                {data.applicationName}
              </Typography>
              {data.logoUrl ? (
                <Box component="img" src={data.logoUrl} alt="" sx={{ width: 72, height: 72, objectFit: 'contain' }} />
              ) : null}
              <Typography variant="body2" color="text.secondary">
                {data.purpose}
              </Typography>
            </Stack>
            <SearchSelect
              required
              label="User"
              options={data.users}
              value={userId}
              onChange={setUserId}
              getOptionLabel={(user) => user.title}
              getOptionValue={(user) => user.id}
            />
            <PasswordField value={password} onChange={setPassword} />
            {notice ? (
              <Alert severity="warning" onClose={clearNotice}>
                {notice}
              </Alert>
            ) : null}
            {attempt.isError ? (
              <Alert severity="error">
                {attempt.error.code === 'UNAUTHORIZED'
                  ? 'That password is not accepted for this user.'
                  : attempt.error.code === 'VALIDATION'
                    ? attempt.error.message
                    : attempt.error.code === 'UNAVAILABLE'
                      ? appUnavailableMessage()
                      : attempt.error.message}
              </Alert>
            ) : null}
            <Button type="submit" variant="contained" disabled={attempt.isPending || !userId || !password} sx={{ minHeight: 44 }}>
              {attempt.isPending ? 'Signing in' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
