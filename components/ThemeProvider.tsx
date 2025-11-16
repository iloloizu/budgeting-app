'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      setMounted(true)
      const htmlElement = document.documentElement
      
      // Check localStorage for saved theme preference
      const savedTheme = localStorage.getItem('theme') as Theme | null
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setTheme(savedTheme)
        if (savedTheme === 'dark') {
          htmlElement.classList.add('dark')
        } else {
          htmlElement.classList.remove('dark')
        }
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const initialTheme = prefersDark ? 'dark' : 'light'
        setTheme(initialTheme)
        if (initialTheme === 'dark') {
          htmlElement.classList.add('dark')
        } else {
          htmlElement.classList.remove('dark')
        }
      }
    } catch (err: any) {
      console.error('Theme initialization error:', err)
    }
  }, [])

  const toggleTheme = () => {
    try {
      const newTheme = theme === 'light' ? 'dark' : 'light'
      
      // Toggle dark class on html element FIRST (before state update for immediate visual feedback)
      const htmlElement = document.documentElement
      if (newTheme === 'dark') {
        htmlElement.classList.add('dark')
      } else {
        htmlElement.classList.remove('dark')
      }
      
      // Update state
      setTheme(newTheme)
      
      // Save to localStorage
      try {
        localStorage.setItem('theme', newTheme)
      } catch (storageErr: any) {
        // Silently fail - theme will still work for this session
        console.error('localStorage error:', storageErr)
      }
    } catch (err: any) {
      console.error('Theme toggle error:', err)
    }
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

