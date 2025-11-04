
"use client";

import React from 'react';
import { User, HeartPulse, Shield, ShieldAlert, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { type ChatMessage as ChatMessageType } from '@/lib/types';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MemoizedReactMarkdown = React.memo(({ content, references }: { content: string, references: ChatMessageType['references'] }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-p:leading-relaxed prose-sm max-w-none"
            components={{
                a: ({ node, ...props }) => {
                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />;
                },
                p: ({ children, ...props }) => {
                    const processedChildren = React.Children.toArray(children).flatMap((child, index) => {
                        if (typeof child !== 'string') {
                            return child;
                        }

                        const parts: (string | JSX.Element)[] = [];
                        let lastIndex = 0;
                        const citationRegex = /\[(\d+)\]/g;
                        let match;

                        while ((match = citationRegex.exec(child)) !== null) {
                            const textBefore = child.substring(lastIndex, match.index);
                            if (textBefore) {
                                parts.push(textBefore);
                            }

                            const citationNumber = parseInt(match[1], 10);
                            const reference = references?.[citationNumber - 1];

                            if (reference?.url) {
                                parts.push(
                                    <Popover key={`${match.index}-${index}`}>
                                        <PopoverTrigger asChild>
                                            <a
                                                href={reference.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 font-semibold cursor-pointer hover:underline"
                                            >
                                                [{citationNumber}]
                                            </a>
                                        </PopoverTrigger>
                                        <PopoverContent side="top" className="max-w-xs break-words text-sm p-2 bg-background border rounded-lg shadow-lg">
                                            {reference.title || `Source [${citationNumber}]`}
                                        </PopoverContent>
                                    </Popover>
                                );
                            } else {
                                parts.push(match[0]); // If no valid link found, render as text
                            }
                            lastIndex = citationRegex.lastIndex;
                        }

                        const remainingText = child.substring(lastIndex);
if (remainingText) {
                            parts.push(remainingText);
                        }
                        
                        return parts.length > 0 ? parts : [child];
                    });
                    
                    return <p {...props}>{processedChildren}</p>;
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
});
MemoizedReactMarkdown.displayName = 'MemoizedReactMarkdown';


export function ChatMessage({ message, onGuardrailClick }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const hasGuardrailInfo = !!message.guardrailResult;

    return (
        <div className={cn('group flex items-start gap-4', isUser ? 'justify-end' : '')}>
            {!isUser && (
                 <Avatar className="h-10 w-10 border bg-primary text-primary-foreground">
                    <AvatarFallback className="bg-transparent text-blue-500">
                        <HeartPulse />
                    </AvatarFallback>
                </Avatar>
            )}

            <div className={cn("relative flex items-center max-w-full", isUser ? 'justify-end' : 'justify-start')}>
                 <div
                    className={cn(
                        'max-w-prose rounded-lg p-4 shadow-sm',
                         isUser ? 'bg-card' : 'bg-primary',
                        message.isBlocked && 'bg-muted border',
                        isUser ? 'order-1' : 'order-2'
                    )}
                >
                    {message.isBlocked && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                            <Ban className="h-4 w-4" />
                            <span>This content was blocked by the safety filter.</span>
                        </div>
                    )}
                    <div className={cn(
                        "font-body text-base leading-relaxed text-foreground",
                        message.isBlocked ? "text-muted-foreground italic" : ""
                    )}>
                        <MemoizedReactMarkdown content={message.content} references={message.references || []} />
                    </div>
                </div>
                {hasGuardrailInfo && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 opacity-0 group-hover:opacity-100",
                             isUser ? "order-2 ml-2" : "order-1 mr-2"
                        )}
                        onClick={onGuardrailClick}
                    >
                        {message.isBlocked ? <ShieldAlert className="h-5 w-5 text-muted-foreground" /> : <Shield className="h-5 w-5 text-muted-foreground/70" />}
                        <span className="sr-only">View Guardrail Details</span>
                    </Button>
                )}
            </div>

            {isUser && (
                <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600">
                    <AvatarFallback className="bg-transparent">
                        <User />
                    </AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}

const BlinkingDots = () => (
    <div className="flex items-center space-x-1 text-foreground">
        <span className="h-2 w-2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-current"></span>
        <span className="h-2 w-2 animate-[pulse_1s_ease-in-out_0.2s_infinite] rounded-full bg-current"></span>
        <span className="h-2 w-2 animate-[pulse_1s_ease-in-out_0.4s_infinite] rounded-full bg-current"></span>
    </div>
);

export function LoadingMessage() {
    return (
        <div className="flex items-start gap-4">
             <Avatar className="h-10 w-10 border bg-primary text-primary-foreground">
                <AvatarFallback className="bg-transparent text-blue-500">
                    <HeartPulse />
                </AvatarFallback>
            </Avatar>
            <div className="max-w-prose rounded-lg p-4 shadow-sm bg-primary text-primary-foreground">
                <BlinkingDots />
            </div>
        </div>
    );
}

interface ChatMessageProps {
  message: ChatMessageType;
  onGuardrailClick: () => void;
}
