import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'llm-sentinel-theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Default to dark mode
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return (stored as Theme) || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme }
}

