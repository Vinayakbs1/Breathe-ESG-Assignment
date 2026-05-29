import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

const LIGHT = {
  bg:           '#f5f5f5',
  surface:      '#ffffff',
  surfaceHover: '#fafafa',
  border:       '#e5e5e5',
  borderStrong: '#d4d4d4',
  text:         '#0a0a0a',
  textMuted:    '#525252',
  textFaint:    '#a3a3a3',
  accent:       '#0a0a0a',
  accentText:   '#ffffff',
  accentHover:  '#262626',
  danger:       '#dc2626',
  dangerBg:     '#fef2f2',
  success:      '#16a34a',
  successBg:    '#f0fdf4',
  warn:         '#d97706',
  warnBg:       '#fffbeb',
  navBg:        '#0a0a0a',
  navText:      'rgba(255,255,255,0.85)',
  navActive:    '#ffffff',
  navMuted:     'rgba(255,255,255,0.45)',
  shadow:       '0 1px 4px rgba(0,0,0,0.08)',
  shadowMd:     '0 4px 16px rgba(0,0,0,0.10)',
}

const DARK = {
  bg:           '#0a0a0a',
  surface:      '#171717',
  surfaceHover: '#1f1f1f',
  border:       '#2a2a2a',
  borderStrong: '#3a3a3a',
  text:         '#fafafa',
  textMuted:    '#a3a3a3',
  textFaint:    '#525252',
  accent:       '#fafafa',
  accentText:   '#0a0a0a',
  accentHover:  '#e5e5e5',
  danger:       '#f87171',
  dangerBg:     '#1c0a0a',
  success:      '#4ade80',
  successBg:    '#0a1c0a',
  warn:         '#fbbf24',
  warnBg:       '#1c1500',
  navBg:        '#000000',
  navText:      'rgba(255,255,255,0.75)',
  navActive:    '#ffffff',
  navMuted:     'rgba(255,255,255,0.35)',
  shadow:       '0 1px 4px rgba(0,0,0,0.4)',
  shadowMd:     '0 4px 16px rgba(0,0,0,0.5)',
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
    document.body.style.background = dark ? DARK.bg : LIGHT.bg
  }, [dark])

  const toggle = () => setDark(d => !d)
  const t = dark ? DARK : LIGHT

  return (
    <ThemeContext.Provider value={{ dark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
