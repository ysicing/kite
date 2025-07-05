import { useTranslation } from 'react-i18next'

import { VersionIndicator } from '@/components/version-indicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function VersionTestPage() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('version.title')}</h1>
        <p className="text-muted-foreground">
          测试版本指示器组件的功能
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>紧凑版本指示器</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              这是在页面头部显示的紧凑版本指示器，点击信息图标查看详细信息。
            </p>
            <div className="flex items-center gap-4">
              <span className="text-sm">版本指示器:</span>
              <VersionIndicator variant="compact" />
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
            </p>
            <Separator className="my-4" />
            <VersionIndicator variant="full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
