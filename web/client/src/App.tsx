import { useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import { useTheme } from './hooks/useTheme'

function App() {
  const { theme } = useTheme()

  // Ensure theme is applied on mount
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ChatInterface />
    </div>
  )
}

export default App

