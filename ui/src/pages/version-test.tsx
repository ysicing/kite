import { useTranslation } from 'react-i18next'
import { ExternalLink, GitCommit, RefreshCw } from 'lucide-react'

import { VersionIndicator } from '@/components/version-indicator'
import { useVersionInfo } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function VersionTestPage() {
  const { t } = useTranslation()
  const { data: versionInfo, isLoading, error, refetch } = useVersionInfo()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GitCommit className="h-8 w-8" />
          {t('version.title')}
        </h1>
        <p className="text-muted-foreground">
          测试版本指示器组件的功能和展示版本检查机制
        </p>
      </div>

      {/* API 状态信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            版本 API 状态
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                加载状态
              </label>
              <Badge variant={isLoading ? "default" : "secondary"}>
                {isLoading ? "加载中..." : "已加载"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                错误状态
              </label>
              <Badge variant={error ? "destructive" : "secondary"}>
                {error ? "有错误" : "正常"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                更新状态
              </label>
              <Badge variant={versionInfo?.hasUpdate ? "default" : "secondary"}>
                {versionInfo?.hasUpdate ? "有更新" : "最新版本"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                最后检查
              </label>
              <Badge variant="outline" className="text-xs">
                {versionInfo?.updatedAt ? 
                  new Date(versionInfo.updatedAt).toLocaleTimeString() : 
                  "未知"
                }
              </Badge>
            </div>
          </div>
          
          {versionInfo && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <h4 className="font-medium">原始 API 数据</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(versionInfo, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 组件测试 */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>紧凑版本指示器</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              这是在页面头部显示的紧凑版本指示器，点击信息图标查看详细信息。
              版本号可以直接点击跳转到对应的 GitHub commit 页面。
            </p>
            <div className="flex items-center gap-4">
              <span className="text-sm">版本指示器:</span>
              <VersionIndicator variant="compact" />
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded text-sm">
              <strong>特性:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>点击 ℹ️ 图标显示详细信息</li>
                <li>版本号可点击跳转到 GitHub</li>
                <li>有更新时显示红色提示点</li>
                <li>支持刷新功能</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>完整版本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              这是完整的版本信息显示，通常用于设置页面或专门的版本页面。
              所有版本号都可以点击跳转到对应的 GitHub commit 页面。
            </p>
            <Separator className="my-4" />
            <VersionIndicator variant="full" />
            <div className="mt-4 p-3 bg-muted/50 rounded text-sm">
              <strong>特性:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>显示当前版本和最新版本</li>
                <li>版本号使用等宽字体显示</li>
                <li>版本号可点击跳转到 GitHub</li>
                <li>有更新时显示绿色提示区域</li>
                <li>显示最后检查时间</li>
                <li>支持手动检查更新</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 版本检查机制说明 */}
      <Card>
        <CardHeader>
          <CardTitle>版本检查机制</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">工作原理</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>当前版本通过环境变量 <code className="bg-muted px-1 rounded">KITE_VERSION</code> 获取</li>
                <li>最新版本通过 GitHub API 获取 main 分支最新提交的 SHA</li>
                <li>如果两个 SHA 不同，则显示有更新</li>
                <li>API 响应会缓存 1 小时，避免频繁请求</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">版本格式</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>版本号为 Git Commit SHA（如：29d7f65c7031682764dcf9e1e98ff3321755133a）</li>
                <li>前端显示时只显示前 8 位（如：29d7f65c）</li>
                <li>使用等宽字体显示，便于识别</li>
                <li>点击版本号会跳转到对应的 GitHub commit 页面</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试方法</h4>
              <div className="bg-muted p-3 rounded text-sm">
                <p className="mb-2">要测试有更新的情况，可以设置一个假的版本号：</p>
                <code className="block bg-background p-2 rounded">
                  KITE_VERSION="abc12345" ./kite
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 链接测试 */}
      {versionInfo && (
        <Card>
          <CardHeader>
            <CardTitle>链接测试</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">当前版本链接:</span>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://github.com/ysicing/kite/commit/${versionInfo.current}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    {versionInfo.current.substring(0, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm">最新版本链接:</span>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://github.com/ysicing/kite/commit/${versionInfo.latest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    {versionInfo.latest.substring(0, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 
