import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Info, RefreshCw } from 'lucide-react'

import { useVersionInfo } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

interface VersionIndicatorProps {
  variant?: 'compact' | 'full'
  className?: string
}

// 格式化SHA显示，只显示前8位
function formatSHA(sha: string): string {
  if (!sha || sha === 'unknown') return sha
  return sha.substring(0, 8)
}

// 生成GitHub commit链接
function getCommitUrl(sha: string): string {
  if (!sha || sha === 'unknown') return ''
  return `https://github.com/ysicing/kite/commit/${sha}`
}

// 可点击的版本Badge组件
function VersionBadge({ sha, className = '' }: { sha: string; className?: string }) {
  const formattedSHA = formatSHA(sha)
  const commitUrl = getCommitUrl(sha)
  
  if (!commitUrl) {
    return (
      <Badge variant="outline" className={`text-xs font-mono ${className}`}>
        {formattedSHA}
      </Badge>
    )
  }
  
  return (
    <Badge variant="outline" className={`text-xs font-mono hover:bg-muted/50 transition-colors ${className}`}>
      <a
        href={commitUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-inherit no-underline"
      >
        {formattedSHA}
        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
      </a>
    </Badge>
  )
}

export function VersionIndicator({ variant = 'compact', className }: VersionIndicatorProps) {
  const { t } = useTranslation()
  const { data: versionInfo, isLoading, error, refetch } = useVersionInfo()
  const [showUpdateBadge, setShowUpdateBadge] = useState(false)

  useEffect(() => {
    if (versionInfo?.hasUpdate) {
      setShowUpdateBadge(true)
      // 显示更新提示5秒后自动隐藏
      const timer = setTimeout(() => {
        setShowUpdateBadge(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [versionInfo?.hasUpdate])

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          {t('version.loading')}
        </span>
      </div>
    )
  }

  if (error || !versionInfo) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-xs">
          {t('version.unknown')}
        </Badge>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={`relative p-2 ${className}`}>
            <Info className="h-4 w-4" />
            {versionInfo.hasUpdate && showUpdateBadge && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{t('version.title')}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('version.current')}
                </span>
                <VersionBadge sha={versionInfo.current} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('version.latest')}
                </span>
                <VersionBadge sha={versionInfo.latest} />
              </div>
            </div>
            
            {versionInfo.hasUpdate && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      {t('version.updateAvailable')}
                    </span>
                  </div>
                  
                  {versionInfo.releaseDate && (
                    <p className="text-xs text-muted-foreground">
                      {t('version.releaseDate', { date: versionInfo.releaseDate })}
                    </p>
                  )}
                  
                  {versionInfo.releaseUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="w-full"
                    >
                      <a
                        href={versionInfo.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        {t('version.viewCommit')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </>
            )}
            
            <Separator />
            
            <p className="text-xs text-muted-foreground">
              {t('version.lastCheck', { 
                time: new Date(versionInfo.updatedAt).toLocaleString() 
              })}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Full variant for settings page or dedicated version page
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('version.title')}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t('version.checkForUpdates')}
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('version.current')}
          </label>
          <VersionBadge sha={versionInfo.current} className="text-sm" />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('version.latest')}
          </label>
          <VersionBadge sha={versionInfo.latest} className="text-sm" />
        </div>
      </div>
      
      {versionInfo.hasUpdate && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 bg-green-500 rounded-full mt-2" />
            <div className="space-y-2">
              <p className="font-medium text-green-700 dark:text-green-400">
                {t('version.updateAvailable')}
              </p>
              <p className="text-sm text-green-600 dark:text-green-300">
                {t('version.updateDescription', { 
                  latest: formatSHA(versionInfo.latest),
                  current: formatSHA(versionInfo.current)
                })}
              </p>
              {versionInfo.releaseDate && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t('version.releaseDate', { date: versionInfo.releaseDate })}
                </p>
              )}
              {versionInfo.releaseUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
                >
                  <a
                    href={versionInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    {t('version.viewCommit')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        {t('version.lastCheck', { 
          time: new Date(versionInfo.updatedAt).toLocaleString() 
        })}
      </div>
    </div>
  )
} 
