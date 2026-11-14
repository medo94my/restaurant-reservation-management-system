import { createTheme, alpha } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d7b46a',
      light: '#f1dfba',
      dark: '#b8944d',
      contrastText: '#241b08',
    },
    secondary: {
      main: '#9da49a',
      light: '#d9ded7',
      dark: '#7d857a',
      contrastText: '#191d1a',
    },
    error: {
      main: '#e07d72',
      light: '#f9d8d5',
      dark: '#581d19',
      contrastText: '#3b110e',
    },
    warning: {
      main: '#d7b46a',
      light: '#f1dfba',
      dark: '#393222',
      contrastText: '#241b08',
    },
    info: {
      main: '#9da49a',
      light: '#d9ded7',
      dark: '#272d28',
      contrastText: '#191d1a',
    },
    success: {
      main: '#7cb382',
      light: '#a4d4aa',
      dark: '#234426',
      contrastText: '#191d1a',
    },
    background: {
      default: '#111312',
      paper: '#171a18',
    },
    text: {
      primary: '#eee9df',
      secondary: '#b0b6ad',
      disabled: '#696f68',
    },
    divider: '#343a35',
    action: {
      active: '#d7b46a',
      hover: 'rgba(215, 180, 106, 0.08)',
      selected: 'rgba(215, 180, 106, 0.16)',
      disabled: 'rgba(238, 233, 223, 0.3)',
      disabledBackground: 'rgba(238, 233, 223, 0.12)',
    },
  },
  typography: {
    fontFamily: "var(--font-dm-sans), 'DM Sans', var(--font-roboto), Roboto, system-ui, sans-serif",
    h1: {
      fontFamily: "var(--brand-font, var(--font-playfair-display), 'Playfair Display', Georgia, serif)",
      color: 'var(--brand-text, #eee9df)',
    },
    h2: {
      fontFamily: "var(--brand-font, var(--font-playfair-display), 'Playfair Display', Georgia, serif)",
      color: 'var(--brand-text, #eee9df)',
    },
    h3: {
      fontFamily: "var(--brand-font, var(--font-playfair-display), 'Playfair Display', Georgia, serif)",
      color: 'var(--brand-text, #eee9df)',
    },
    h4: {
      fontFamily: "var(--brand-font, var(--font-playfair-display), 'Playfair Display', Georgia, serif)",
      color: 'var(--brand-text, #eee9df)',
    },
    h5: {
      fontFamily: "var(--brand-font, var(--font-playfair-display), 'Playfair Display', Georgia, serif)",
      color: 'var(--brand-text, #eee9df)',
    },
    h6: {
      fontFamily: "var(--font-dm-sans), 'DM Sans', var(--font-roboto), Roboto, system-ui, sans-serif",
      fontWeight: 600,
      color: 'var(--brand-text, #eee9df)',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.8125rem', // 13px matching .button
    },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: '2px solid var(--brand-primary, #d7b46a)',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 38,
          minHeight: 38,
          borderRadius: 6,
          '&:focus-visible': {
            outline: '2px solid var(--brand-primary, #d7b46a)',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          minHeight: 38,
          padding: '8px 16px',
          fontWeight: 600,
          fontSize: '13px',
          transition: '0.15s ease-in-out',
          '&:focus-visible': {
            outline: '2px solid var(--brand-primary, #d7b46a)',
            outlineOffset: '2px',
          },
        },
        contained: {
          backgroundColor: 'var(--brand-primary, #d7b46a)',
          color: 'var(--brand-bg, #231d0f)',
          '&:hover': {
            backgroundColor: 'var(--brand-secondary, #e4c681)',
          },
        },
        outlined: {
          borderColor: '#41473f',
          color: 'var(--brand-text, #e8e5dc)',
          backgroundColor: 'var(--brand-surface, #202421)',
          '&:hover': {
            backgroundColor: '#2a302b',
            borderColor: '#77765e',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          '&:focus-visible': {
            outline: '2px solid var(--brand-primary, #d7b46a)',
            outlineOffset: '-2px',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '&:focus-visible, &.Mui-focusVisible': {
            outline: '2px solid var(--brand-primary, #d7b46a)',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--brand-surface, #171a18)',
          borderColor: '#343a35',
          borderRadius: 6,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--brand-surface, #191d1a)',
          borderRadius: 6,
          border: '1px solid #343a35',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          '&:focus, &:focus-visible, &:focus-within, &.Mui-focused': {
            outline: 'none !important',
            boxShadow: 'none !important',
          },
        },
        input: {
          '&:focus, &:focus-visible, &:active': {
            outline: 'none !important',
            boxShadow: 'none !important',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: '#141715',
          color: '#eee9df',
          '&:focus, &:focus-visible, &:focus-within, &.Mui-focused': {
            outline: 'none !important',
            boxShadow: 'none !important',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#343a35',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#696f68',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(215, 180, 106, 0.5)',
            borderWidth: '1px',
          },
        },
        input: {
          '&:focus, &:focus-visible, &:active': {
            outline: 'none !important',
            boxShadow: 'none !important',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#282e29',
          color: '#eee9df',
          border: '1px solid #343a35',
          fontSize: '12px',
          borderRadius: 4,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          borderColor: '#343a35',
        },
      },
    },
  },
})

export default theme
