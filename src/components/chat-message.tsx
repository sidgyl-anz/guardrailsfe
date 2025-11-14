
"use client";

import React from 'react';
import { User, HeartPulse, Shield, ShieldAlert, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { type ChatMessage as ChatMessageType } from '@/lib/types';
import { Button } from './ui/button';
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

const MemoizedReactMarkdown = React.memo(({ content }: { content: string }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-p:leading-relaxed prose-sm max-w-none"
            components={{
                a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
});
MemoizedReactMarkdown.displayName = 'MemoizedReactMarkdown';

const getReferencedSources = (
    content: string,
    references?: ChatMessageType['references']
): NonNullable<ChatMessageType['references']> => {
    if (!content || !references || references.length === 0) {
        return [];
    }

    const citationRegex = /\[(\d+)\]/g;
    const seen = new Set<number>();
    const referencedSources: NonNullable<ChatMessageType['references']> = [];
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(content)) !== null) {
        const citationNumber = parseInt(match[1], 10);

        if (
            Number.isNaN(citationNumber) ||
            citationNumber < 1 ||
            citationNumber > references.length ||
            seen.has(citationNumber)
        ) {
            continue;
        }

        const reference = references[citationNumber - 1];
        if (reference) {
            referencedSources.push(reference);
            seen.add(citationNumber);
        }
    }

    return referencedSources;
};

const stripInlineCitationMarkers = (content: string, shouldStrip: boolean) => {
    if (!shouldStrip || !content) {
        return content;
    }

    return content.replace(/(\s*)\[(\d+)\]/g, (_, whitespace: string) => whitespace);
};

const AllSourcesCarousel = ({ references }: { references: NonNullable<ChatMessageType['references']> }) => {
    if (!references || references.length === 0) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All Sources
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:gap-3 sm:overflow-x-auto sm:pb-2">
                {references.map((reference, index) => {
                    const domain = getDomainFromUrl(reference.url);
                    const label = reference.title?.trim() || domain || reference.url || `Source ${index + 1}`;

                    if (!reference.url) {
                        return (
                            <div
                                key={`${label}-${index}`}
                                className="w-full rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground sm:min-w-[200px] sm:w-auto sm:flex-shrink-0"
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
                            className="w-full rounded-lg border border-border bg-background p-3 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-w-[200px] sm:w-auto sm:flex-shrink-0"
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
    const inlineReferences = React.useMemo(
        () => getReferencedSources(message.content, message.references),
        [message.content, message.references]
    );
    const displayContent = React.useMemo(
        () => stripInlineCitationMarkers(message.content, !isUser),
        [message.content, isUser]
    );

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
        <div className="group flex w-full items-start gap-3 sm:gap-4">
            {avatar}

            <div className="min-w-0 flex-1">
                <div
                    className={cn(
                        'relative w-full max-w-full rounded-xl p-4 shadow-sm text-left sm:max-w-3xl sm:p-5 lg:max-w-4xl lg:p-6',
                        hasGuardrailInfo && 'pr-12 sm:pr-14',
                        isUser ? 'bg-card' : 'bg-primary',
                        message.isBlocked && 'bg-muted border'
                    )}
                >
                    {message.isBlocked && (
                        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
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
                        <MemoizedReactMarkdown content={displayContent} />
                        {!message.isBlocked && inlineReferences.length > 0 && (
                            <AllSourcesCarousel references={inlineReferences} />
                        )}
                    </div>

                    {hasGuardrailInfo && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'absolute right-3 top-3 h-7 w-7 transition-colors sm:right-4 sm:top-4',
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
        <div className="flex w-full items-start gap-3 sm:gap-4">
            <Avatar className="h-10 w-10 border bg-primary text-primary-foreground">
                <AvatarFallback className="bg-transparent text-blue-500">
                    <HeartPulse />
                </AvatarFallback>
            </Avatar>
            <div className="w-full max-w-full rounded-xl bg-primary p-4 text-primary-foreground shadow-sm sm:max-w-3xl sm:p-5 lg:max-w-4xl lg:p-6">
                <BlinkingDots />
            </div>
        </div>
    );
}

interface ChatMessageProps {
  message: ChatMessageType;
  onGuardrailClick: () => void;
}
