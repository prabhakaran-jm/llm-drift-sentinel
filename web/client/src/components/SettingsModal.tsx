import { useState, useEffect } from 'react'
import { getRules, deleteRule, toggleRule, Rule } from '../utils/rulesStorage'
import { useTheme } from '../hooks/useTheme'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [rules, setRules] = useState<Rule[]>([])
  const [activeTab, setActiveTab] = useState<'general' | 'rules'>('general')
  const { theme, toggleTheme } = useTheme()
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const stored = localStorage.getItem('llm-sentinel-auto-refresh')
    return stored ? JSON.parse(stored) : true
  })
  const [notifications, setNotifications] = useState(() => {
    const stored = localStorage.getItem('llm-sentinel-notifications')
    return stored ? JSON.parse(stored) : false
  })

  useEffect(() => {
    if (isOpen) {
      setRules(getRules())
    }
  }, [isOpen])

  const handleToggleRule = (ruleId: string) => {
    toggleRule(ruleId)
    setRules(getRules())
  }

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      deleteRule(ruleId)
      setRules(getRules())
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-gray-200 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        <div className="p-6 border-b dark:border-[#27272a] border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold dark:text-white text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#facc15]">settings</span>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white hover:text-gray-900 transition-colors p-2 hover:dark:bg-white/5 hover:bg-gray-100 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-[#27272a] border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-[#facc15] border-b-2 border-[#facc15]'
                : 'dark:text-white/50 text-gray-600 hover:dark:text-white hover:text-gray-900'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'rules'
                ? 'text-[#facc15] border-b-2 border-[#facc15]'
                : 'dark:text-white/50 text-gray-600 hover:dark:text-white hover:text-gray-900'
            }`}
          >
            Rules ({rules.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold dark:text-white text-gray-900 mb-4">Application Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 dark:bg-[#0c0c0c] bg-white rounded-lg dark:border-[#27272a] border-gray-200 border">
                    <div>
                      <div className="text-sm font-medium dark:text-white text-gray-900">Theme</div>
                      <div className="text-xs dark:text-white/50 text-gray-500 mt-1">
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={theme === 'dark'}
                        onChange={toggleTheme}
                        className="sr-only peer" 
                      />
                      <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                        theme === 'dark' 
                          ? 'bg-[#facc15] after:left-[2px]' 
                          : 'bg-slate-300 after:left-[22px]'
                      }`}></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 dark:bg-[#0c0c0c] bg-white rounded-lg dark:border-[#27272a] border-gray-200 border">
                    <div>
                      <div className="text-sm font-medium dark:text-white text-gray-900">Auto-refresh</div>
                      <div className="text-xs dark:text-white/50 text-gray-500 mt-1">Refresh data every 30 seconds</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoRefresh}
                        onChange={(e) => {
                          setAutoRefresh(e.target.checked)
                          localStorage.setItem('llm-sentinel-auto-refresh', JSON.stringify(e.target.checked))
                        }}
                        className="sr-only peer" 
                      />
                      <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                        autoRefresh ? 'bg-[#facc15] after:left-[2px]' : 'bg-[#27272a]'
                      }`}></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 dark:bg-[#0c0c0c] bg-white rounded-lg dark:border-[#27272a] border-gray-200 border">
                    <div>
                      <div className="text-sm font-medium dark:text-white text-gray-900">Notifications</div>
                      <div className="text-xs dark:text-white/50 text-gray-500 mt-1">Show browser notifications for alerts</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifications}
                        onChange={(e) => {
                          setNotifications(e.target.checked)
                          localStorage.setItem('llm-sentinel-notifications', JSON.stringify(e.target.checked))
                          if (e.target.checked && Notification.permission === 'default') {
                            Notification.requestPermission()
                          }
                        }}
                        className="sr-only peer" 
                      />
                      <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                        notifications ? 'bg-[#facc15] after:left-[2px]' : 'bg-[#27272a]'
                      }`}></div>
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white text-gray-900 mb-4">Data Management</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all local storage? This will remove all messages, rules, and settings.')) {
                        localStorage.clear()
                        alert('Local storage cleared. Please refresh the page.')
                        window.location.reload()
                      }
                    }}
                    className="w-full p-4 dark:bg-[#0c0c0c] bg-white hover:dark:bg-[#0c0c0c]/80 hover:bg-gray-50 dark:border-[#27272a] border-gray-200 border rounded-lg text-left transition-colors"
                  >
                    <div className="text-sm font-medium dark:text-white text-gray-900">Clear Local Storage</div>
                    <div className="text-xs dark:text-white/50 text-gray-500 mt-1">Remove all locally stored data</div>
                  </button>
                  <button
                    onClick={() => {
                      const allData = {
                        rules: getRules(),
                        settings: {
                          autoRefresh,
                          notifications,
                          theme,
                        },
                        exportDate: new Date().toISOString(),
                      }
                      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `llm-sentinel-export-${new Date().toISOString().split('T')[0]}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="w-full p-4 dark:bg-[#0c0c0c] bg-white hover:dark:bg-[#0c0c0c]/80 hover:bg-gray-50 dark:border-[#27272a] border-gray-200 border rounded-lg text-left transition-colors"
                  >
                    <div className="text-sm font-medium dark:text-white text-gray-900">Export All Data</div>
                    <div className="text-xs dark:text-white/50 text-gray-500 mt-1">Download all sessions and rules</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div>
              <h3 className="text-lg font-bold dark:text-white text-gray-900 mb-4">Active Rules</h3>
              {rules.length === 0 ? (
                <div className="text-center py-12 dark:bg-[#0c0c0c] bg-gray-50 rounded-lg dark:border-[#27272a] border-gray-200 border">
                  <span className="material-symbols-outlined text-4xl dark:text-white/20 text-gray-300 mb-2 block">rule</span>
                  <p className="dark:text-white/50 text-gray-600">No rules configured</p>
                  <p className="text-sm dark:text-white/30 text-gray-400 mt-1">Create rules from the "New Rule" button</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-4 dark:bg-[#0c0c0c] bg-gray-50 rounded-lg dark:border-[#27272a] border-gray-200 border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium dark:text-white text-gray-900">{rule.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              rule.enabled
                                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                                : 'dark:bg-white/5 bg-gray-200 dark:text-white/50 text-gray-600 dark:border-white/10 border-gray-300'
                            }`}>
                              {rule.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="text-xs dark:text-white/50 text-gray-600 space-y-1">
                            <div>When: {rule.triggerCondition}</div>
                            <div>Action: {rule.action}</div>
                            <div className="dark:text-white/30 text-gray-400">Created: {new Date(rule.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleRule(rule.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              rule.enabled
                                ? 'bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20'
                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                            }`}
                            title={rule.enabled ? 'Disable' : 'Enable'}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {rule.enabled ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-2 rounded-lg bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t dark:border-[#27272a] border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

