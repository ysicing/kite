import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AiChatDialog } from './ai-chat-dialog'
import { ChatGPTIcon } from './icons/chatgpt-icon'

export function AiChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* 右下角浮动按钮 */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-200 p-0"
        >
          <ChatGPTIcon className="text-current" size={14} />
        </Button>
      </div>

      {/* 聊天对话框 */}
      <AiChatDialog 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
} 
