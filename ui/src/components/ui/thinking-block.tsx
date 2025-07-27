import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

interface ThinkingBlockProps {
  content: string
  className?: string
  defaultExpanded?: boolean
}

export function ThinkingBlock({ content, className, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!content.trim()) {
    return null
  }

  return (
    <div className={cn(
      'border border-dashed border-gray-300 dark:border-gray-600 rounded-lg my-2',
      'bg-purple-50 dark:bg-purple-950/20',
      className
    )}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-start p-3 h-auto font-normal text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
      >
        <Brain className="h-4 w-4 mr-2 flex-shrink-0" />
        <span className="flex-1 text-left">思考过程</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0" />
        )}
      </Button>
      
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="border-t border-purple-200 dark:border-purple-700 pt-3">
            <Markdown 
              content={content} 
              className="text-sm text-purple-800 dark:text-purple-200" 
            />
          </div>
        </div>
      )}
    </div>
  )
}