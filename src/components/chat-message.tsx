
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

const getDomainFromUrl = (url: string | undefined) => {
    if (!url) return undefined;

    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '');
    } catch {
        return undefined;
    }
};

const CitationPopover = ({
    citationNumbers,
    references,
}: {
    citationNumbers: number[];
    references?: ChatMessageType['references'];
}) => {
    const [open, setOpen] = React.useState(false);

    if (!references || references.length === 0 || citationNumbers.length === 0) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-600 shadow-sm"
            >
                <span className="text-[10px] uppercase tracking-wide text-blue-500">Sources</span>
                <span aria-hidden className="h-1 w-1 rounded-full bg-blue-200" />
                <span className="text-xs font-semibold">{citationNumbers.length}</span>
            </span>
        );
    }

    const selectedReferences = citationNumbers
        .map((citationNumber) => references[citationNumber - 1])
        .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference));

    if (selectedReferences.length === 0) {
        return <span>[{citationNumbers.join(', ')}]</span>;
    }

    const primaryReference = selectedReferences[0];
    const primaryDomain = getDomainFromUrl(primaryReference?.url);
    const primaryLabel =
        primaryReference?.title?.trim() || primaryDomain || primaryReference?.url || 'Source';

    const citationCount = selectedReferences.length;
    const citationCountLabel = `${citationCount} ${citationCount === 1 ? 'source' : 'sources'}`;

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
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    aria-label={`View ${citationCountLabel} for ${primaryLabel}`}
                >
                    <span className="text-[10px] uppercase tracking-wide text-blue-500">Sources</span>
                    <span aria-hidden className="h-1 w-1 rounded-full bg-blue-200" />
                    <span className="text-xs font-semibold text-blue-700">{citationCount}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                className="w-96 space-y-3 rounded-xl border border-slate-200 p-4 shadow-lg"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <div className="inline-flex items-center gap-2">
                        <span className="uppercase tracking-wide text-[11px] text-blue-500">Sources</span>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                            {citationCount}
                        </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{citationCountLabel}</span>
                </div>
                <ul className="space-y-2">
                    {selectedReferences.map((reference, index) => {
                        const domain = getDomainFromUrl(reference.url);
                        const label = reference.title?.trim() || domain || reference.url || `Source ${index + 1}`;
                        const key = reference.url || `${reference.title}-${index}`;

                        if (!reference.url) {
                            return (
                                <li
                                    key={key}
                                    className={cn(
                                        'rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground',
                                    )}
                                >
                                    {label}
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
                                        'flex flex-col gap-1 rounded-lg border border-transparent p-3 transition-colors hover:border-blue-200 hover:bg-blue-50',
                                        'bg-background',
                                        index === 0 && 'border-blue-200 bg-blue-50'
                                    )}
                                >
                                    <span className="text-sm font-medium text-foreground">{label}</span>
                                    {domain && (
                                        <span className="text-xs text-muted-foreground">{domain}</span>
                                    )}
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
                        const citationRegex = /(?:\[(\d+)\])+/g;
                        let match;

                        while ((match = citationRegex.exec(child)) !== null) {
                            const textBefore = child.substring(lastIndex, match.index);
                            if (textBefore) {
                                parts.push(textBefore);
                            }

                            const citationNumbers = Array.from(match[0].matchAll(/\[(\d+)\]/g)).map((citationMatch) =>
                                parseInt(citationMatch[1], 10)
                            );
                            const validCitationNumbers = citationNumbers.filter(
                                (citationNumber) => references && references.length >= citationNumber
                            );

                            if (validCitationNumbers.length > 0) {
                                parts.push(
                                    <CitationPopover
                                        key={`${match.index}-${index}`}
                                        citationNumbers={validCitationNumbers}
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

const SourcesCarousel = ({ references }: { references: NonNullable<ChatMessageType['references']> }) => {
    if (!references || references.length === 0) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All Sources
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {references.map((reference, index) => {
                    const domain = getDomainFromUrl(reference.url);
                    const label = reference.title?.trim() || domain || reference.url || `Source ${index + 1}`;

                    if (!reference.url) {
                        return (
                            <div
                                key={`${label}-${index}`}
                                className="min-w-[200px] rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
                            >
                                {label}
                            </div>
                        );
                    }

                    return (
                        <a
                            key={reference.url || `${label}-${index}`}
                            href={reference.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-[200px] flex-shrink-0 rounded-lg border border-border bg-background p-3 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50"
                        >
                            <div className="text-sm font-medium text-foreground line-clamp-2">{label}</div>
                            {domain && (
                                <div className="mt-1 text-xs text-muted-foreground">{domain}</div>
                            )}
                        </a>
                    );
                })}
            </div>
        </div>
    );
};


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
                        'max-w-3xl rounded-xl p-6 shadow-sm text-left',
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
                        {!message.isBlocked && message.references && message.references.length > 0 && (
                            <SourcesCarousel references={message.references} />
                        )}
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
            <div className="max-w-3xl rounded-xl p-6 shadow-sm bg-primary text-primary-foreground">
                <BlinkingDots />
            </div>
        </div>
    );
}

interface ChatMessageProps {
  message: ChatMessageType;
  onGuardrailClick: () => void;
}
