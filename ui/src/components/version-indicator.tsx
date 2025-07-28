import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Info, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { useVersionInfo, upgradeKite } from '@/lib/api'
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

// Format SHA display to show only first 8 characters
function formatSHA(sha: string): string {
  if (!sha || sha === 'unknown') return sha
  return sha.substring(0, 8)
}

// Generate GitHub commit link
function getCommitUrl(sha: string): string {
  if (!sha || sha === 'unknown') return ''
  return `https://github.com/ysicing/kite/commit/${sha}`
}

// Clickable version Badge component
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
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    
    try {
      const result = await upgradeKite()
      
      toast.success(t('version.upgradeSuccess'), {
        description: result.message,
      })
      
      // Wait a few seconds then refresh version info
      setTimeout(() => {
        refetch()
      }, 3000)
      
    } catch (error) {
      toast.error(t('version.upgradeError'), {
        description: error instanceof Error ? error.message : t('version.upgradeError'),
      })
    } finally {
      setTimeout(() => {
        setIsUpgrading(false)
      }, 1000)
    }
  }

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
            {versionInfo?.hasUpdate && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
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
                <VersionBadge sha={versionInfo?.current || 'unknown'} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('version.latest')}
                </span>
                <VersionBadge sha={versionInfo?.latest || 'unknown'} />
              </div>
            </div>
            
            {versionInfo?.hasUpdate && (
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
                  
                  <div className="flex gap-2">
                    {versionInfo.releaseUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1"
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
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleUpgrade}
                      disabled={isUpgrading}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isUpgrading ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                          {t('version.upgrading')}
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 mr-2" />
                          {t('version.upgrade')}
                        </>
                      )}
                    </Button>
                  </div>
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
            <div className="space-y-2 flex-1">
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
              <div className="flex gap-2 pt-2">
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
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isUpgrading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {t('version.upgrading')}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {t('version.upgrade')}
                    </>
                  )}
                </Button>
              </div>
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
