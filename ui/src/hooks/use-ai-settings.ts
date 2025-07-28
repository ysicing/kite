import { useState, useEffect } from 'react'

interface OpenAISettings {
  apiUrl: string
  apiKey: string
  model: string
}

const DEFAULT_SETTINGS: OpenAISettings = {
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
}

const STORAGE_KEY = 'kite-ai-settings'

export const useAiSettings = () => {
  const [settings, setSettings] = useState<OpenAISettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // 加载设置
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // 监听localStorage变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setSettings({ ...DEFAULT_SETTINGS, ...parsed })
        } catch (error) {
          console.error('Failed to parse updated settings:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // 保存设置
  const saveSettings = (newSettings: Partial<OpenAISettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings))
      setSettings(updatedSettings)
      // 触发自定义事件，用于同一页面内的组件通信
      window.dispatchEvent(new CustomEvent('ai-settings-changed', { 
        detail: updatedSettings 
      }))
      return true
    } catch (error) {
      console.error('Failed to save AI settings:', error)
      return false
    }
  }

  // 重置设置
  const resetSettings = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setSettings(DEFAULT_SETTINGS)
      window.dispatchEvent(new CustomEvent('ai-settings-changed', { 
        detail: DEFAULT_SETTINGS 
      }))
      return true
    } catch (error) {
      console.error('Failed to reset AI settings:', error)
      return false
    }
  }

  // 检查设置是否有效
  const isConfigured = () => {
    return Boolean(settings.apiUrl && settings.apiKey && settings.model)
  }

  // 监听自定义事件（用于同一页面内的组件间通信）
  useEffect(() => {
    const handleSettingsChange = (e: CustomEvent) => {
      setSettings(e.detail)
    }

    window.addEventListener('ai-settings-changed', handleSettingsChange as EventListener)
    return () => window.removeEventListener('ai-settings-changed', handleSettingsChange as EventListener)
  }, [])

  return {
    settings,
    saveSettings,
    resetSettings,
    isConfigured,
    isLoaded
  }
}

export const getAiSettings = (): OpenAISettings => {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('Failed to get AI settings:', error)
  }
  return DEFAULT_SETTINGS
}

export const setAiSettings = (newSettings: Partial<OpenAISettings>): boolean => {
  try {
    const currentSettings = getAiSettings()
    const updatedSettings = { ...currentSettings, ...newSettings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings))
    return true
  } catch (error) {
    console.error('Failed to set AI settings:', error)
    return false
  }
}

export type { OpenAISettings }
