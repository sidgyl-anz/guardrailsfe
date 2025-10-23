
"use client";

import React from 'react';
import { User, HeartPulse, Shield, ShieldAlert, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { type ChatMessage as ChatMessageType } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: ChatMessageType;
  onGuardrailClick: () => void;
}

const MemoizedReactMarkdown = ({ content, references }: { content: string, references: ChatMessageType['references'] }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-p:leading-relaxed prose-sm"
            components={{
                a: ({ node, ...props }) => {
                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />;
                },
                p: ({ node, ...props }) => {
                    const contentWithCitations = React.Children.map(props.children, (child) => {
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

                                // Handle the citation group
                                const citationNumbers = match[0].match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
                                const citationLinks = citationNumbers.map(number => {
                                    const reference = references?.[number - 1];
                                    return {
                                        number,
                                        uri: reference?.uri || '',
                                        title: reference?.title || `Source [${number}]`,
                                    };
                                }).filter(ref => ref.uri);


                                if (citationLinks.length > 0) {
                                    parts.push(
                                        <Popover key={match.index}>
                                            <PopoverTrigger asChild>
                                                <span className="text-primary font-semibold cursor-pointer">
                                                    {citationLinks.map((link) => `[${link.number}]`).join('')}
                                                </span>
                                            </PopoverTrigger>
                                            <PopoverContent className="max-w-xs break-words" align="start">
                                                <ul className="space-y-2">
                                                    {citationLinks.map((link) => (
                                                        <li key={link.uri}>
                                                            <a
                                                                href={link.uri}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:underline"
                                                            >
                                                                <span className="font-semibold text-primary mr-2">[{link.number}]</span>
                                                                {link.title}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </PopoverContent>
                                        </Popover>
                                    );
                                }


                                lastIndex = citationRegex.lastIndex;
                            }

                            // Add remaining text
                            if (lastIndex < child.length) {
                                parts.push(child.substring(lastIndex));
                            }
                            
                            return <>{parts}</>;
                        }
                        return child;
                    });
                    
                    return <p {...props}>{contentWithCitations}</p>;
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
};


export function ChatMessage({ message, onGuardrailClick }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const hasGuardrailInfo = !!message.guardrailResult;

    return (
        <div className={cn('group flex items-start gap-4 animate-in fade-in', isUser ? 'justify-end' : '')}>
            {!isUser && (
                <Avatar className="h-10 w-10 border border-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                        <HeartPulse />
                    </AvatarFallback>
                </Avatar>
            )}

            <div className="relative">
                <div
                    className={cn(
                        'max-w-prose rounded-lg p-4 shadow-md',
                        'bg-card text-card-foreground',
                        message.isBlocked && 'bg-muted border'
                    )}
                >
                    {message.isBlocked && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                            <Ban className="h-4 w-4" />
                            <span>I cannot answer this so pls ask a question with more details</span>
                        </div>
                    )}
                    <div className={cn(
                        "font-body text-base leading-relaxed",
                        message.isBlocked ? "text-muted-foreground italic whitespace-pre-wrap" : ""
                    )}>
                        {isUser ? (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                        ) : (
                            <MemoizedReactMarkdown content={message.content} references={message.references || []} />
                        )}
                    </div>
                </div>
                {hasGuardrailInfo && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-7 w-7 opacity-100",
                            isUser ? "-left-10" : "-right-10",
                        )}
                        onClick={onGuardrailClick}
                    >
                        {message.isBlocked ? <ShieldAlert className="h-5 w-5 text-muted-foreground" /> : <Shield className="h-5 w-5 text-muted-foreground/70" />}
                        <span className="sr-only">View Guardrail Details</span>
                    </Button>
                )}
            </div>

            {isUser && (
                <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn("bg-card text-card-foreground", message.isBlocked && "bg-muted text-muted-foreground")}>
                        <User />
                    </AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}

export function LoadingMessage() {
    return (
        <div className='flex items-start gap-4 animate-in fade-in'>
            <Avatar className="h-10 w-10 border border-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                    <HeartPulse />
                </AvatarFallback>
            </Avatar>
            <div className="max-w-[75%] w-full rounded-lg p-4 shadow-md bg-card space-y-3">
                <div className="flex items-center space-x-2">
                    <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/50 animate-pulse" />
                    <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:0.2s]" />
                    <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:0.4s]" />
                </div>
            </div>
        </div>
    );
}
