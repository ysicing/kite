import React from 'react'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const parseMarkdown = (text: string): JSX.Element[] => {
    const lines = text.split('\n')
    const elements: JSX.Element[] = []
    let inCodeBlock = false
    let codeBlockLanguage = ''
    let codeBlockContent: string[] = []
    let listItems: string[] = []
    let inList = false

    const processInlineMarkdown = (line: string): JSX.Element => {
      // 处理行内代码
      line = line.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      
      // 处理粗体
      line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      line = line.replace(/__([^_]+)__/g, '<strong>$1</strong>')
      
      // 处理斜体
      line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>')
      line = line.replace(/_([^_]+)_/g, '<em>$1</em>')
      
      // 处理链接
      line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="link">$1</a>')
      
      return <span dangerouslySetInnerHTML={{ __html: line }} />
    }

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc pl-4 my-2 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx}>{processInlineMarkdown(item)}</li>
            ))}
          </ul>
        )
        listItems = []
        inList = false
      }
    }

    const flushCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <pre key={elements.length} className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 my-2 overflow-x-auto">
            <code className="text-sm">
              {codeBlockContent.join('\n')}
            </code>
          </pre>
        )
        codeBlockContent = []
        codeBlockLanguage = ''
        inCodeBlock = false
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // 处理代码块
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock()
        } else {
          flushList()
          inCodeBlock = true
          codeBlockLanguage = trimmedLine.slice(3)
        }
        continue
      }

      if (inCodeBlock) {
        codeBlockContent.push(line)
        continue
      }

      // 处理标题
      if (trimmedLine.startsWith('#')) {
        flushList()
        const level = trimmedLine.match(/^#+/)?.[0].length || 1
        const text = trimmedLine.replace(/^#+\s*/, '')
        const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements
        
        elements.push(
          <Tag key={elements.length} className={cn(
            'font-semibold my-2',
            level === 1 && 'text-2xl',
            level === 2 && 'text-xl',
            level === 3 && 'text-lg',
            level >= 4 && 'text-base'
          )}>
            {processInlineMarkdown(text)}
          </Tag>
        )
        continue
      }

      // 处理列表
      if (trimmedLine.match(/^[-*+]\s+/)) {
        const listItem = trimmedLine.replace(/^[-*+]\s+/, '')
        listItems.push(listItem)
        inList = true
        continue
      }

      // 处理数字列表
      if (trimmedLine.match(/^\d+\.\s+/)) {
        if (!inList || listItems.length === 0) {
          flushList()
        }
        const listItem = trimmedLine.replace(/^\d+\.\s+/, '')
        if (!inList) {
          elements.push(
            <ol key={elements.length} className="list-decimal pl-4 my-2 space-y-1">
              <li>{processInlineMarkdown(listItem)}</li>
            </ol>
          )
        }
        continue
      }

      // 如果不是列表项，先清空列表
      if (inList && !trimmedLine.match(/^[-*+]\s+/)) {
        flushList()
      }

      // 处理空行
      if (trimmedLine === '') {
        if (elements.length > 0) {
          elements.push(<br key={elements.length} />)
        }
        continue
      }

      // 处理普通段落
      if (trimmedLine) {
        flushList()
        elements.push(
          <p key={elements.length} className="my-1">
            {processInlineMarkdown(line)}
          </p>
        )
      }
    }

    // 清理剩余的内容
    flushList()
    flushCodeBlock()

    return elements
  }

  return (
    <div className={cn(
      'prose prose-sm max-w-none',
      'prose-gray dark:prose-invert',
      // 自定义样式
      '[&_.inline-code]:bg-gray-100 [&_.inline-code]:dark:bg-gray-700 [&_.inline-code]:px-1.5 [&_.inline-code]:py-0.5 [&_.inline-code]:rounded [&_.inline-code]:text-sm [&_.inline-code]:font-mono',
      '[&_.link]:text-blue-600 [&_.link]:dark:text-blue-400 [&_.link]:hover:underline',
      // 确保在对话框中的样式
      '[&_p]:my-1 [&_p]:leading-relaxed',
      '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-2',
      '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2',
      '[&_h3]:text-sm [&_h3]:font-medium [&_h3]:my-1',
      '[&_ul]:my-2 [&_ol]:my-2',
      '[&_pre]:my-2 [&_pre]:text-xs',
      '[&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2',
      className
    )}>
      {parseMarkdown(content)}
    </div>
  )
}