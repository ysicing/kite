import React, { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Send, User, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChatGPTIcon } from './icons/chatgpt-icon'
import { AiSettingsDialog } from './ai-settings-dialog'
import { useAiSettings } from '@/hooks/use-ai-settings'
import { Markdown } from '@/components/ui/markdown'
import { ThinkingBlock } from '@/components/ui/thinking-block'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  timestamp: Date
  isStreaming?: boolean
}

interface AiChatDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function AiChatDialog({ isOpen, onClose }: AiChatDialogProps) {
  const { t } = useTranslation()
  const { settings, isConfigured, isLoaded } = useAiSettings()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('ai.welcome'),
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // 流式API调用
  const streamApiCall = async (messages: any[], onChunk: (chunk: string, thinking?: string) => void) => {
    const response = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === '' || trimmed === 'data: [DONE]') continue
          
          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6)
              const data = JSON.parse(jsonStr)
              
              if (data.choices && data.choices[0]) {
                const delta = data.choices[0].delta
                
                // 处理思考内容
                if (delta.thinking) {
                  onChunk('', delta.thinking)
                }
                
                // 处理正常内容
                if (delta.content) {
                  onChunk(delta.content)
                }
              }
            } catch (e) {
              console.warn('Failed to parse streaming response:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    // 检查是否已配置AI设置
    if (!isConfigured()) {
      alert(t('ai.settings.notConfigured'))
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 创建流式响应的消息
    const streamingMessageId = (Date.now() + 1).toString()
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, streamingMessage])

    try {
      const messageHistory = messages
        .filter(m => m.role !== 'assistant' || m.id !== '1')
        .map(m => ({
          role: m.role,
          content: m.content
        }))

      messageHistory.push({
        role: 'user',
        content: inputValue
      })

      const apiMessages = [
        {
          role: 'system',
          content: 'You are a helpful Kubernetes assistant. Please provide detailed and accurate answers about Kubernetes concepts, troubleshooting, and best practices. If you need to think through the problem, use thinking tags to show your reasoning process.'
        },
        ...messageHistory
      ]

      await streamApiCall(apiMessages, (contentChunk: string, thinkingChunk?: string) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === streamingMessageId) {
            return {
              ...msg,
              content: thinkingChunk ? msg.content : msg.content + contentChunk,
              thinking: thinkingChunk ? (msg.thinking || '') + thinkingChunk : msg.thinking,
            }
          }
          return msg
        }))
      })

      // 标记流式完成
      setMessages(prev => prev.map(msg => {
        if (msg.id === streamingMessageId) {
          return { ...msg, isStreaming: false }
        }
        return msg
      }))

    } catch (error) {
      console.error('AI API error:', error)
      
      // 如果流式调用失败，移除流式消息并添加回退消息
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId))
      
      const aiResponse: Message = {
        id: streamingMessageId,
        role: 'assistant',
        content: generateAiResponse(inputValue),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiResponse])
    } finally {
      setIsLoading(false)
    }
  }

  const generateAiResponse = (userInput: string): string => {
    const input = userInput.toLowerCase()
    
    if (input.includes('pod') && input.includes('状态')) {
      return '关于Pod状态问题，常见的排查步骤：\n\n1. **查看Pod状态**：`kubectl get pods -o wide`\n2. **查看详细信息**：`kubectl describe pod <pod-name>`\n3. **查看日志**：`kubectl logs <pod-name>`\n4. **常见问题**：\n   • ImagePullBackOff：镜像拉取失败\n   • CrashLoopBackOff：容器启动后崩溃\n   • Pending：资源不足或调度失败\n\n需要具体的错误信息才能进一步诊断。'
    }
    
    if (input.includes('部署') || input.includes('deploy')) {
      return 'Kubernetes应用部署的几种方式：\n\n1. **Deployment**（推荐）：\n```yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: my-app\n  template:\n    metadata:\n      labels:\n        app: my-app\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n```\n\n2. **使用kubectl**：`kubectl create deployment my-app --image=nginx`\n3. **使用Helm**：更复杂的应用部署\n\n需要更具体的部署需求吗？'
    }
    
    if (input.includes('service') || input.includes('服务')) {
      return 'Kubernetes Service类型及用途：\n\n1. **ClusterIP**（默认）：集群内部访问\n2. **NodePort**：通过节点端口访问\n3. **LoadBalancer**：云平台负载均衡器\n4. **ExternalName**：外部服务映射\n\n**示例配置**：\n```yaml\napiVersion: v1\nkind: Service\nmetadata:\n  name: my-service\nspec:\n  selector:\n    app: my-app\n  ports:\n  - port: 80\n    targetPort: 8080\n  type: ClusterIP\n```\n\n你需要哪种类型的Service配置？'
    }
    
    if (input.includes('存储') || input.includes('volume') || input.includes('pv')) {
      return 'Kubernetes存储解决方案：\n\n1. **Volume类型**：\n   • emptyDir：临时存储\n   • hostPath：主机路径\n   • configMap/secret：配置存储\n   • persistentVolumeClaim：持久化存储\n\n2. **PV和PVC**：\n```yaml\n# PersistentVolume\napiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: my-pv\nspec:\n  capacity:\n    storage: 10Gi\n  accessModes:\n  - ReadWriteOnce\n  hostPath:\n    path: /data\n```\n\n需要配置哪种存储类型？'
    }
    
    if (input.includes('网络') || input.includes('ingress')) {
      return 'Kubernetes网络配置：\n\n1. **Ingress**：HTTP/HTTPS路由\n```yaml\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: my-ingress\nspec:\n  rules:\n  - host: example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: my-service\n            port:\n              number: 80\n```\n\n2. **NetworkPolicy**：网络安全策略\n3. **DNS**：服务发现\n\n具体需要配置什么网络功能？'
    }
    
    // 默认回复
    return `我理解你在询问关于"${userInput}"的问题。\n\n作为Kubernetes助手，我可以帮你解答：\n• 应用部署和管理\n• Pod、Service、Ingress配置\n• 存储和网络问题\n• 故障排查和最佳实践\n• YAML配置文件编写\n• kubectl命令使用\n\n请详细描述你遇到的具体问题，我会提供更精准的帮助！`
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full h-[600px] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/api/placeholder/32/32" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <ChatGPTIcon size={16} />
                </AvatarFallback>
              </Avatar>
              <DialogTitle>{t('ai.assistant')}</DialogTitle>
            </div>
            <AiSettingsDialog>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </AiSettingsDialog>
          </div>
          {!isConfigured() && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-sm text-yellow-800">
              {t('ai.settings.configurationRequired')}
            </div>
          )}
        </DialogHeader>

        {/* 消息区域 */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/api/placeholder/32/32" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <ChatGPTIcon size={16} />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted'
                  }`}
                >
                  {/* 思考过程（仅对助手消息显示） */}
                  {message.role === 'assistant' && message.thinking && (
                    <ThinkingBlock content={message.thinking} className="mb-3" />
                  )}
                  
                  {/* 消息内容 */}
                  <div className="text-sm">
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <Markdown 
                        content={message.content || (message.isStreaming ? '正在思考...' : '')} 
                        className={message.role === 'assistant' ? 'text-foreground' : ''}
                      />
                    )}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1">|</span>
                    )}
                  </div>
                  
                  <div className={`text-xs mt-2 opacity-70 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                    {message.isStreaming && ' • 正在生成...'}
                  </div>
                </div>

                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/api/placeholder/32/32" />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarImage src="/api/placeholder/32/32" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <ChatGPTIcon size={16} />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('ai.placeholder')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!inputValue.trim() || isLoading || !isConfigured()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 
