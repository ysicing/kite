import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAiSettings, type OpenAISettings } from '@/hooks/use-ai-settings'

interface AiSettingsDialogProps {
  children?: React.ReactNode
}

interface ValidationErrors {
  apiUrl?: string
  apiKey?: string
  model?: string
}

export function AiSettingsDialog({ children }: AiSettingsDialogProps) {
  const { t } = useTranslation()
  const { settings: currentSettings, saveSettings: saveSettingsToStore } = useAiSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [settings, setSettings] = useState<OpenAISettings>(currentSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isTesting, setIsTesting] = useState(false)

  // 当对话框打开时，同步当前设置
  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings)
      setErrors({})
    }
  }, [isOpen, currentSettings])

  // 验证表单
  const validateSettings = (settingsToValidate: OpenAISettings): ValidationErrors => {
    const newErrors: ValidationErrors = {}

    // 验证API URL
    if (!settingsToValidate.apiUrl.trim()) {
      newErrors.apiUrl = t('ai.settings.errors.apiUrlRequired')
    } else {
      try {
        new URL(settingsToValidate.apiUrl)
      } catch {
        newErrors.apiUrl = t('ai.settings.errors.invalidUrl')
      }
    }

    // 验证API Key
    if (!settingsToValidate.apiKey.trim()) {
      newErrors.apiKey = t('ai.settings.errors.apiKeyRequired')
    } else if (settingsToValidate.apiKey.length < 10) {
      newErrors.apiKey = t('ai.settings.errors.apiKeyTooShort')
    }

    // 验证模型
    if (!settingsToValidate.model.trim()) {
      newErrors.model = t('ai.settings.errors.modelRequired')
    }

    return newErrors
  }

  // 保存设置
  const saveSettings = () => {
    const validationErrors = validateSettings(settings)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsLoading(true)
    try {
      const success = saveSettingsToStore(settings)
      if (success) {
        setIsOpen(false)
        setErrors({})
      } else {
        alert(t('ai.settings.errors.saveFailed'))
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error)
      alert(t('ai.settings.errors.saveFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  // 测试连接
  const testConnection = async () => {
    const validationErrors = validateSettings(settings)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsTesting(true)
    try {
      const response = await fetch(`${settings.apiUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      })

      if (response.ok) {
        alert(t('ai.settings.connectionSuccess'))
      } else {
        const errorText = await response.text()
        alert(t('ai.settings.connectionFailed') + `: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert(t('ai.settings.errors.timeout'))
        } else {
          alert(t('ai.settings.connectionError') + `: ${error.message}`)
        }
      } else {
        alert(t('ai.settings.connectionError'))
      }
    } finally {
      setIsTesting(false)
    }
  }

  const handleInputChange = (field: keyof OpenAISettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
            {t('ai.settings.title')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('ai.settings.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API地址 */}
          <div className="space-y-2">
            <Label htmlFor="apiUrl">{t('ai.settings.apiUrl')}</Label>
            <Input
              id="apiUrl"
              value={settings.apiUrl}
              onChange={(e) => handleInputChange('apiUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className={errors.apiUrl ? 'border-red-500' : ''}
            />
            {errors.apiUrl && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.apiUrl}
              </div>
            )}
          </div>

          {/* API密钥 */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">{t('ai.settings.apiKey')}</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                placeholder="sk-..."
                className={`pr-10 ${errors.apiKey ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            </div>
            {errors.apiKey && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.apiKey}
              </div>
            )}
          </div>

          {/* 模型 */}
          <div className="space-y-2">
            <Label htmlFor="model">{t('ai.settings.model')}</Label>
            <Input
              id="model"
              value={settings.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              placeholder="gpt-4o-mini"
              className={errors.model ? 'border-red-500' : ''}
            />
            {errors.model && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.model}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2 pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={isTesting || isLoading}
              className="flex-1"
            >
              {isTesting ? t('ai.settings.testing') : t('ai.settings.testConnection')}
            </Button>
            <Button
              onClick={saveSettings}
              disabled={isLoading || isTesting}
              className="flex-1"
            >
              {isLoading ? t('ai.settings.saving') : t('ai.settings.save')}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground text-center">
            {t('ai.settings.storageNote')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 导出获取设置的工具函数（保持向后兼容）
export const getAiSettings = (): OpenAISettings => {
  try {
    const savedSettings = localStorage.getItem('ai-settings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      const DEFAULT_SETTINGS: OpenAISettings = {
        apiUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini'
      }
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('Failed to parse AI settings:', error)
  }
  return {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  }
}
