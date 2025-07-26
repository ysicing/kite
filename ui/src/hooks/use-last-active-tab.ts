import { useCallback, useEffect, useState } from 'react'

const LAST_ACTIVE_TAB_STORAGE_KEY = 'kite-last-active-tab'

/**
 * Hook to manage and persist the last active tab across page refreshes
 * 
 * 这个hook用于记住用户在高级功能页面中最后访问的tab，当用户从详情页面返回时，
 * 会自动跳转到之前的tab而不是默认的openkruise tab。
 * 
 * 功能特点:
 * - 基于集群存储：每个集群独立记录最后活跃的tab
 * - 自动持久化：使用localStorage保存状态
 * - 容错处理：localStorage访问失败时使用默认值
 * 
 * @param defaultTab 默认的tab值，如果没有保存的状态则使用此值
 * @returns {object} 包含activeTab和updateActiveTab的对象
 */
export function useLastActiveTab(defaultTab: string = 'openkruise') {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)

  // Get last active tab from localStorage
  const getLastActiveTab = useCallback((): string => {
    const cluster = localStorage.getItem('current-cluster') || ''
    try {
      const lastTab = localStorage.getItem(cluster + LAST_ACTIVE_TAB_STORAGE_KEY)
      return lastTab || defaultTab
    } catch {
      return defaultTab
    }
  }, [defaultTab])

  // Save last active tab to localStorage
  const saveLastActiveTab = useCallback((tab: string) => {
    const cluster = localStorage.getItem('current-cluster') || ''
    try {
      localStorage.setItem(cluster + LAST_ACTIVE_TAB_STORAGE_KEY, tab)
    } catch (error) {
      console.error('Failed to save last active tab:', error)
    }
  }, [])

  // Load last active tab on mount
  useEffect(() => {
    const lastTab = getLastActiveTab()
    setActiveTab(lastTab)
  }, [getLastActiveTab])

  // Update active tab and save to localStorage
  const updateActiveTab = useCallback((tab: string) => {
    setActiveTab(tab)
    saveLastActiveTab(tab)
  }, [saveLastActiveTab])

  return {
    activeTab,
    updateActiveTab,
  }
} 
