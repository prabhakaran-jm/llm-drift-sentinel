import { useState } from 'react'
import { saveRule } from '../utils/rulesStorage'

interface NewRuleModalProps {
  isOpen: boolean
  onClose: () => void
  onRuleCreated?: () => void
}

export default function NewRuleModal({ isOpen, onClose, onRuleCreated }: NewRuleModalProps) {
  const [ruleName, setRuleName] = useState('')
  const [triggerCondition, setTriggerCondition] = useState('Safety Score < 0.3')
  const [action, setAction] = useState('Block Request')

  if (!isOpen) return null

  const handleCreate = () => {
    if (!ruleName.trim()) {
      alert('Please enter a rule name')
      return
    }

    saveRule({
      name: ruleName.trim(),
      triggerCondition,
      action,
      enabled: true,
    })

    console.log(`[NewRule] Created rule: ${ruleName} (${triggerCondition} → ${action})`)
    
    // Reset form
    setRuleName('')
    setTriggerCondition('Safety Score < 0.3')
    setAction('Block Request')
    
    onRuleCreated?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 dark:border-[#27272a] border-slate-200 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold dark:text-white text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#facc15]">add_circle</span>
            Create New Rule
          </h2>
          <button
            onClick={onClose}
            className="dark:text-[#a1a1aa] text-slate-500 hover:dark:text-white hover:text-slate-900 p-2 hover:dark:bg-white/5 hover:bg-slate-100 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-white/70 text-slate-700 mb-2">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Block SQL Injection Attempts"
              className="w-full dark:bg-[#0c0c0c] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#facc15] focus:border-[#facc15] shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-white/70 text-slate-700 mb-2">Trigger Condition</label>
            <select
              value={triggerCondition}
              onChange={(e) => setTriggerCondition(e.target.value)}
              className="w-full dark:bg-[#0c0c0c] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#facc15] shadow-sm"
            >
              <option>Safety Score &lt; 0.3</option>
              <option>Safety Score &lt; 0.5</option>
              <option>Drift Score &gt; 0.4</option>
              <option>Specific Safety Label</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-white/70 text-slate-700 mb-2">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full dark:bg-[#0c0c0c] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#facc15] shadow-sm"
            >
              <option>Block Request</option>
              <option>Flag for Review</option>
              <option>Send Alert</option>
              <option>Log Only</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 dark:bg-[#27272a] bg-slate-200 hover:dark:bg-[#3f3f46] hover:bg-slate-300 dark:text-white text-slate-900 rounded-lg shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold rounded-lg shadow-sm"
            >
              Create Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

