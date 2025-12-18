export interface Rule {
  id: string
  name: string
  triggerCondition: string
  action: string
  enabled: boolean
  createdAt: string
}

const RULES_STORAGE_KEY = 'llm-sentinel-rules'

export function getRules(): Rule[] {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveRule(rule: Omit<Rule, 'id' | 'createdAt'>): Rule {
  const rules = getRules()
  const newRule: Rule = {
    ...rule,
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  rules.push(newRule)
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  return newRule
}

export function deleteRule(ruleId: string): void {
  const rules = getRules().filter(r => r.id !== ruleId)
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
}

export function toggleRule(ruleId: string): void {
  const rules = getRules()
  const rule = rules.find(r => r.id === ruleId)
  if (rule) {
    rule.enabled = !rule.enabled
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  }
}

export function evaluateRules(
  safetyScore?: number,
  safetyLabel?: string,
  driftScore?: number
): { matched: boolean; rule?: Rule; action?: string } {
  const rules = getRules().filter(r => r.enabled)
  
  for (const rule of rules) {
    let matched = false
    
    // Evaluate trigger condition
    if (rule.triggerCondition === 'Safety Score < 0.3') {
      matched = safetyScore !== undefined && safetyScore < 0.3
    } else if (rule.triggerCondition === 'Safety Score < 0.5') {
      matched = safetyScore !== undefined && safetyScore < 0.5
    } else if (rule.triggerCondition === 'Drift Score > 0.4') {
      matched = driftScore !== undefined && driftScore > 0.4
    } else if (rule.triggerCondition === 'Specific Safety Label') {
      // This would need additional configuration, simplified for now
      matched = safetyLabel === 'JAILBREAK' || safetyLabel === 'PROMPT_INJECTION'
    }
    
    if (matched) {
      return { matched: true, rule, action: rule.action }
    }
  }
  
  return { matched: false }
}

