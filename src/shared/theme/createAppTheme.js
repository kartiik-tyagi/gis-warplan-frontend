import { alpha, createTheme } from '@mui/material/styles'

export function createAppTheme(themeConfig) {
  const mode = themeConfig.mode === 'light' ? 'light' : 'dark'
  const ink = themeConfig.textPrimary

  const notice = (name) => ({
    backgroundColor: alpha(themeConfig[name], mode === 'dark' ? 0.2 : 0.16),
    color: themeConfig.textPrimary,
    '& .MuiAlert-icon': { color: themeConfig[name] },
  })

  return createTheme({
    palette: {
      mode,
      primary: { main: themeConfig.primary, contrastText: themeConfig.primaryContrast },
      secondary: { main: themeConfig.secondary, contrastText: themeConfig.secondaryContrast },
      background: {
        default: themeConfig.backgroundDefault,
        paper: themeConfig.backgroundPaper,
      },
      text: {
        primary: themeConfig.textPrimary,
        secondary: themeConfig.textSecondary,
        disabled: themeConfig.textDisabled,
      },
      divider: themeConfig.divider,
      error: { main: themeConfig.error, contrastText: themeConfig.errorContrast },
      warning: { main: themeConfig.warning, contrastText: themeConfig.warningContrast },
      success: { main: themeConfig.success, contrastText: themeConfig.successContrast },
      info: { main: themeConfig.info, contrastText: themeConfig.infoContrast },
      action: {
        active: ink,
        hover: alpha(ink, mode === 'dark' ? 0.14 : 0.1),
        selected: alpha(ink, mode === 'dark' ? 0.22 : 0.16),
        disabled: themeConfig.textDisabled,
        disabledBackground: alpha(ink, 0.12),
        focus: alpha(ink, 0.18),
      },
    },
    shape: { borderRadius: themeConfig.borderRadius },
    typography: {
      fontFamily: themeConfig.fontFamily,
      fontWeightLight: themeConfig.fontWeightLight,
      fontWeightRegular: themeConfig.fontWeightRegular,
      fontWeightMedium: themeConfig.fontWeightMedium,
      fontWeightBold: themeConfig.fontWeightBold,
      h4: { fontSize: 'clamp(1.5rem, 2.4vw, 2.125rem)', fontWeight: themeConfig.fontWeightBold, lineHeight: 1.25 },
      h5: { fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)', fontWeight: themeConfig.fontWeightBold, lineHeight: 1.3 },
      h6: { fontSize: '1.05rem', fontWeight: themeConfig.fontWeightMedium, lineHeight: 1.35 },
      subtitle1: { fontWeight: themeConfig.fontWeightMedium, lineHeight: 1.4 },
      subtitle2: { fontWeight: themeConfig.fontWeightMedium, lineHeight: 1.4 },
      body1: { fontWeight: themeConfig.fontWeightRegular, lineHeight: 1.5 },
      body2: { fontWeight: themeConfig.fontWeightRegular, lineHeight: 1.45 },
      caption: { fontWeight: themeConfig.fontWeightRegular, lineHeight: 1.4 },
      button: { textTransform: 'none', fontWeight: themeConfig.fontWeightMedium },
      overline: { fontWeight: themeConfig.fontWeightMedium, letterSpacing: '0.08em', lineHeight: 1.4 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            color: themeConfig.textPrimary,
            backgroundColor: themeConfig.backgroundDefault,
            fontFamily: themeConfig.fontFamily,
          },
          // Keep the outline closed. The label sits inside the box, so the border
          // wraps over it instead of opening a gap through the text.
          '.MuiOutlinedInput-notchedOutline > legend': {
            maxWidth: '0.01px !important',
          },
        },
      },
      MuiButton: {
        styleOverrides: { root: { minHeight: 40, textTransform: 'none', fontWeight: themeConfig.fontWeightMedium, fontFamily: themeConfig.fontFamily } },
      },
      MuiIconButton: {
        styleOverrides: { root: { minHeight: 40, minWidth: 40 } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { minHeight: 40, color: themeConfig.textPrimary } },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: themeConfig.textSecondary,
            lineHeight: 1.2,
          },
          outlined: {
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, 7px) scale(0.75)',
              backgroundColor: 'transparent',
              padding: 0,
              marginLeft: 0,
              lineHeight: 1.2,
              maxWidth: 'calc(100% - 28px)',
            },
            '&.MuiInputLabel-sizeSmall.MuiInputLabel-shrink': {
              transform: 'translate(14px, 4px) scale(0.75)',
            },
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: { root: { color: themeConfig.textSecondary } },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            '&:has(> .MuiInputLabel-shrink) .MuiOutlinedInput-root:not(.MuiOutlinedInput-multiline):not(.MuiAutocomplete-inputRoot) .MuiOutlinedInput-input': {
              paddingTop: 26,
              paddingBottom: 8,
            },
            '&:has(> .MuiInputLabel-shrink) .MuiOutlinedInput-root.MuiInputBase-sizeSmall:not(.MuiOutlinedInput-multiline):not(.MuiAutocomplete-inputRoot) .MuiOutlinedInput-input': {
              paddingTop: 20,
              paddingBottom: 4,
            },
            '&:has(> .MuiInputLabel-shrink) .MuiOutlinedInput-multiline': {
              paddingTop: 26,
              paddingBottom: 8,
            },
            '&:has(> .MuiInputLabel-shrink) .MuiOutlinedInput-multiline.MuiInputBase-sizeSmall': {
              paddingTop: 20,
              paddingBottom: 6,
            },
            '&:has(> .MuiInputLabel-shrink) .MuiAutocomplete-inputRoot': {
              paddingTop: 26,
            },
            '&:has(> .MuiInputLabel-shrink) .MuiAutocomplete-inputRoot.MuiInputBase-sizeSmall': {
              paddingTop: 20,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: { root: { fontFamily: themeConfig.fontFamily } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { color: themeConfig.textPrimary, backgroundColor: 'transparent' },
          notchedOutline: { borderColor: themeConfig.divider },
          input: { '&::placeholder': { color: themeConfig.textDisabled, opacity: 1 } },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => (ownerState.variant === 'standard' ? notice(ownerState.severity) : {}),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: themeConfig.textPrimary,
            color: themeConfig.backgroundPaper,
            fontFamily: themeConfig.fontFamily,
            fontWeight: themeConfig.fontWeightRegular,
            fontSize: '0.75rem',
          },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { backgroundImage: 'none' } },
      },
      MuiMenu: {
        styleOverrides: { paper: { backgroundImage: 'none' } },
      },
    },
  })
}
