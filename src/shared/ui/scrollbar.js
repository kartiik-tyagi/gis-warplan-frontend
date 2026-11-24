/** Shared thin scrollbar look for overflow regions across the app. */
export const scrollbarSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(120, 120, 120, 0.55) transparent',
  '&::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(120, 120, 120, 0.45)',
    borderRadius: 8,
    border: '2px solid transparent',
    backgroundClip: 'content-box',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'rgba(120, 120, 120, 0.7)',
  },
}
