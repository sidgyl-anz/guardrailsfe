
"use client";

import React from 'react';
import { User, HeartPulse, Shield, ShieldAlert, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { type ChatMessage as ChatMessageType } from '@/lib/types';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: ChatMessageType;
  onGuardrailClick: () => void;
}

const MemoizedReactMarkdown = React.memo(({ content, references }: { content: string, references: ChatMessageType['references'] }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-p:leading-relaxed prose-sm"
            components={{
                a: ({ node, ...props }) => {
                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />;
                },
                p: ({ node, ...props }) => {
                    const childrenArray = React.Children.toArray(props.children);
                    const processedChildren = childrenArray.map((child, index) => {
                        if (typeof child === 'string') {
                            const citationRegex = /(\[\d+\])+/g;
                            const parts: (string | JSX.Element)[] = [];
                            let lastIndex = 0;
                            let match;

                            while ((match = citationRegex.exec(child)) !== null) {
                                // Add text before the citation group
                                if (match.index > lastIndex) {
                                    parts.push(child.substring(lastIndex, match.index));
                                }

                                // Handle the citation group (e.g., "[1][2]")
                                const citationNumbers = match[0].match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
                                
                                const citationLinks = citationNumbers
                                    .map(number => {
                                        const reference = references?.[number - 1]; // citations are 1-based
                                        return {
                                            number,
                                            uri: reference?.uri || '',
                                            title: reference?.title || `Source [${number}]`,
                                        };
                                    })
                                    .filter(ref => ref.uri);

                                if (citationLinks.length > 0) {
                                    parts.push(
                                        <TooltipProvider delayDuration={100} key={`${match.index}-${index}`}>
                                            <span className="inline-flex">
                                                {citationLinks.map((link) => (
                                                    <Tooltip key={link.uri || link.number}>
                                                        <TooltipTrigger asChild>
                                                            <a
                                                                href={link.uri}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary font-semibold cursor-pointer"
                                                            >
                                                                [{link.number}]
                                                            </a>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs break-words text-sm">
                                                            {link.title}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </span>
                                        </TooltipProvider>
                                    );
                                } else {
                                     parts.push(match[0]); // If no valid link found, render as text
                                }

                                lastIndex = citationRegex.lastIndex;
                            }

                            // Add remaining text
                            if (lastIndex < child.length) {
                                parts.push(child.substring(lastIndex));
                            }
                            
                            return <React.Fragment key={index}>{parts}</React.Fragment>;
                        }
                        return child;
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
        <div className={cn('group flex items-start gap-4', isUser ? '' : 'flex-row-reverse')}>
            <Avatar className="h-10 w-10">
                <AvatarFallback className={cn("bg-card text-card-foreground", message.isBlocked && "bg-muted text-muted-foreground")}>
                    {isUser ? <HeartPulse /> : <User />}
                </AvatarFallback>
            </Avatar>

            <div className="relative">
                <div
                    className={cn(
                        'max-w-prose rounded-lg p-4 shadow-md',
                        isUser ? 'bg-card text-card-foreground' : 'bg-primary text-primary-foreground',
                        message.isBlocked && 'bg-muted border'
                    )}
                >
                    {message.isBlocked && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                            <Ban className="h-4 w-4" />
                            <span>This content was blocked by the safety filter.</span>
                        </div>
                    )}
                    <div className={cn(
                        "font-body text-base leading-relaxed",
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
                            "absolute top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100",
                            isUser ? "-right-10" : "-left-10"
                        )}
                        onClick={onGuardrailClick}
                    >
                        {message.isBlocked ? <ShieldAlert className="h-5 w-5 text-muted-foreground" /> : <Shield className="h-5 w-5 text-muted-foreground/70" />}
                        <span className="sr-only">View Guardrail Details</span>
                    </Button>
                )}
            </div>
        </div>
    );
}

export function LoadingMessage() {
    return (
        <div className="flex items-center justify-start">
            <div className="rounded-full bg-primary/10 px-4 py-2 shadow-inner">
                <span className="text-primary text-lg font-semibold tracking-[0.4em] animate-pulse">...</span>
            </div>
        </div>
    );
}
