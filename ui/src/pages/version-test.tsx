import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconNetwork, IconTag } from '@tabler/icons-react'

const VersionTest: React.FC = () => {
  // 模拟不同的版本状态
  const testCases = [
    {
      title: 'Tailscale 已安装 - 有版本信息',
      installed: true,
      version: 'v1.76.1'
    },
    {
      title: 'Tailscale 已安装 - 无版本信息',
      installed: true,
      version: null
    },
    {
      title: 'Tailscale 未安装',
      installed: false,
      version: null
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tailscale 版本显示测试</h1>
      
      {testCases.map((testCase, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconNetwork className="h-6 w-6" />
                <span>Tailscale 概览</span>
              </div>
              <div className="flex items-center gap-2">
                {testCase.installed && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    ✓ Installed
                  </Badge>
                )}
                {testCase.version && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <IconTag className="h-3 w-3" />
                    版本: {testCase.version}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{testCase.title}</p>
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <pre className="text-xs">
                {JSON.stringify({
                  installed: testCase.installed,
                  version: testCase.version
                }, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card>
        <CardHeader>
          <CardTitle>实际效果预览</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            这是 Tailscale 概览页面在有版本信息时的实际效果：
          </p>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <IconNetwork className="h-6 w-6" />
              <h2 className="text-xl font-semibold">Tailscale 概览</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                ✓ Installed
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <IconTag className="h-3 w-3" />
                版本: v1.76.1
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default VersionTest 
