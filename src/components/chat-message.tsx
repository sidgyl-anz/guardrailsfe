
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

const CitationPopover = ({
    citationNumber,
    references,
}: {
    citationNumber: number;
    references?: ChatMessageType['references'];
}) => {
    const [open, setOpen] = React.useState(false);

    if (!references || references.length === 0) {
        return <span>[{citationNumber}]</span>;
    }

    const handleOpen = (next: boolean) => setOpen(next);
    const handleMouseEnter = () => setOpen(true);
    const handleMouseLeave = () => setOpen(false);

    return (
        <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onFocus={handleMouseEnter}
                    onBlur={handleMouseLeave}
                    className="inline-flex items-center text-blue-600 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded-sm"
                    aria-label={`View sources for citation ${citationNumber}`}
                >
                    [{citationNumber}]
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                className="w-72 p-3 space-y-2"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
                <ul className="space-y-1">
                    {references.map((reference, index) => {
                        const label = reference.title?.trim() || reference.url;
                        const key = reference.url || `${reference.title}-${index}`;
                        const isActive = index === citationNumber - 1;

                        if (!reference.url) {
                            return (
                                <li key={key} className="text-sm text-muted-foreground">
                                    <span className="mr-1 text-xs text-muted-foreground">[{index + 1}]</span>
                                    {label || `Source [${index + 1}]`}
                                </li>
                            );
                        }

                        return (
                            <li key={key}>
                                <a
                                    href={reference.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        'flex items-start gap-2 text-sm text-blue-600 hover:underline',
                                        isActive ? 'font-semibold text-blue-700' : ''
                                    )}
                                >
                                    <span className="text-xs text-muted-foreground">[{index + 1}]</span>
                                    <span className="text-left break-words">{label || `Source [${index + 1}]`}</span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </PopoverContent>
        </Popover>
    );
};

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
                            const hasReferences = references && references.length >= citationNumber;

                            if (hasReferences) {
                                parts.push(
                                    <CitationPopover
                                        key={`${match.index}-${index}`}
                                        citationNumber={citationNumber}
                                        references={references}
                                    />
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

    const avatar = (
        <Avatar
            className={cn(
                'h-10 w-10 border',
                isUser ? 'bg-blue-50 text-blue-600' : 'bg-primary text-primary-foreground'
            )}
        >
            <AvatarFallback
                className={cn(
                    'bg-transparent',
                    isUser ? 'text-blue-600' : 'text-blue-500'
                )}
            >
                {isUser ? <User /> : <HeartPulse />}
            </AvatarFallback>
        </Avatar>
    );

    return (
        <div className="group flex items-start gap-4">
            {avatar}

            <div className="relative flex items-start max-w-full">
                <div
                    className={cn(
                        'max-w-prose rounded-lg p-4 shadow-sm text-left',
                        isUser ? 'bg-card' : 'bg-primary',
                        message.isBlocked && 'bg-muted border'
                    )}
                >
                    {message.isBlocked && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                            <Ban className="h-4 w-4" />
                            <span>This content was blocked by the safety filter.</span>
                        </div>
                    )}
                    <div
                        className={cn(
                            'font-body text-base leading-relaxed text-foreground',
                            message.isBlocked ? 'text-muted-foreground italic' : ''
                        )}
                    >
                        <MemoizedReactMarkdown content={message.content} references={message.references || []} />
                    </div>
                </div>
                {hasGuardrailInfo && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'ml-2 h-7 w-7 self-start transition-colors',
                            message.isBlocked
                                ? 'text-red-600 hover:text-red-700 hover:bg-red-50 focus-visible:ring-red-500'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50 focus-visible:ring-green-500'
                        )}
                        onClick={onGuardrailClick}
                    >
                        {message.isBlocked ? <ShieldAlert className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                        <span className="sr-only">View Guardrail Details</span>
                    </Button>
                )}
            </div>
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
