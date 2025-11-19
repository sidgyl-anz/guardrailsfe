
"use client";

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { collection, serverTimestamp, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { Send, Code, LogIn, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { type ChatMessageType, type Conversation } from '@/lib/types';
import { ChatMessage, LoadingMessage } from '@/components/chat-message';
import { ConversationHistory } from '@/components/conversation-history';
import { SettingsDialog } from '@/components/settings-dialog';
import { GuardrailResultDialog } from '@/components/guardrail-result-dialog';
import { AuthDialog } from '@/components/auth-dialog';
import { UserMenu } from '@/components/user-menu';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DebugView } from '@/components/debug-view';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { callGuardrails, generateConversationTitle } from './actions';
import { DEFAULT_CONVERSATION_TITLE } from '@/lib/conversation-titles';

type ApiTransaction = {
  request: any;
  response: any;
};

type MinimalMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type SearchResult = {
  url?: string;
  title?: string;
  metadata?: {
    cleaned_open_access?: string;
    doi?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

const DOI_BASE_URL = 'http://dx.doi.org/';
const DOI_URL_PATTERN = /^https?:\/\/(dx\.)?doi\.org\//i;

const normalizeDoi = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(DOI_URL_PATTERN, '');
};

const buildDoiUrl = (doi?: string): string | undefined => {
  if (!doi) {
    return undefined;
  }
  return `${DOI_BASE_URL}${doi}`;
};

const ensureCleanedOpenAccessUrl = (result: SearchResult): string | undefined => {
  const metadata =
    result && typeof result.metadata === 'object' && result.metadata !== null
      ? result.metadata
      : undefined;

  const existing = typeof metadata?.cleaned_open_access === 'string'
    ? metadata.cleaned_open_access.trim()
    : '';
  if (existing) {
    return existing;
  }

  const doi = normalizeDoi(metadata?.doi);
  if (!doi) {
    return undefined;
  }

  const doiUrl = buildDoiUrl(doi);
  result.metadata = {
    ...(metadata ?? {}),
    cleaned_open_access: doiUrl,
  };
  return doiUrl;
};

const mapSearchResultsToReferences = (results: SearchResult[] | undefined | null) => {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map((result, index) => {
      if (!result || typeof result !== 'object') {
        return null;
      }

      const metadata =
        result.metadata && typeof result.metadata === 'object'
          ? result.metadata
          : undefined;

      const cleanedOpenAccessUrl = ensureCleanedOpenAccessUrl(result);
      const fallbackDoiUrl = !cleanedOpenAccessUrl ? buildDoiUrl(normalizeDoi(metadata?.doi)) : undefined;
      const candidateUrl =
        cleanedOpenAccessUrl ||
        (typeof result.url === 'string' && result.url.trim().length > 0 ? result.url : undefined) ||
        fallbackDoiUrl;

      if (!candidateUrl) {
        return null;
      }

      const titleSource =
        (typeof result.title === 'string' && result.title.trim().length > 0
          ? result.title
          : typeof metadata?.title === 'string' && metadata.title.trim().length > 0
            ? metadata.title
            : undefined) ?? `Source ${index + 1}`;

      return { url: candidateUrl, title: titleSource };
    })
    .filter((reference): reference is { url: string; title: string } => Boolean(reference));
};

const MAX_REQUEST_CHARACTERS = 80_000;
const MAX_MESSAGE_CHARACTERS = 6_000;
const MIN_MESSAGES_TO_PRESERVE = 6;
const MAX_MESSAGES_TO_PRESERVE = 40;

function limitMessageHistorySize(messages: MinimalMessage[]): MinimalMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  const normalized = messages.map(message => ({
    role: message.role,
    content: (message.content ?? '').slice(-MAX_MESSAGE_CHARACTERS),
  }));

  const limitedByCount = normalized.slice(
    -Math.max(MIN_MESSAGES_TO_PRESERVE, Math.min(MAX_MESSAGES_TO_PRESERVE, normalized.length))
  );

  let totalChars = 0;
  const preserved: MinimalMessage[] = [];

  for (let index = limitedByCount.length - 1; index >= 0; index -= 1) {
    const current = limitedByCount[index];
    const available = MAX_REQUEST_CHARACTERS - totalChars;

    if (available <= 0) {
      break;
    }

    let content = current.content;
    if (content.length > available) {
      content = content.slice(-available);
    }

    preserved.unshift({ role: current.role, content });
    totalChars += content.length;
  }

  if (preserved.length === 0) {
    const lastMessage = normalized[normalized.length - 1];
    return [
      {
        role: lastMessage.role,
        content: lastMessage.content.slice(-Math.min(MAX_MESSAGE_CHARACTERS, MAX_REQUEST_CHARACTERS)),
      },
    ];
  }

  if (preserved.length < messages.length) {
    preserved[0] = {
      role: preserved[0].role,
      content: `Earlier messages were truncated for length.\n\n${preserved[0].content}`,
    };
  }

  return preserved;
}

function SidebarAutoCollapse({ userId }: { userId?: string }) {
  const { setOpen } = useSidebar();
  const setOpenRef = useRef(setOpen);

  useEffect(() => {
    setOpenRef.current = setOpen;
  }, [setOpen]);

  useEffect(() => {
    setOpenRef.current(false);
  }, [userId]);

  return null;
}

function HeaderContent() {
  const { isUserLoading, user } = useUser();

  return (
    <>
      <div className="flex items-center gap-2">
        {user && (
          <SidebarTrigger aria-label="Toggle conversation history" />
        )}
        <HeartPulse className="h-6 w-6 text-blue-500" />
        <h1 className="text-xl font-headline font-bold">Safe Health Chat</h1>
      </div>
      <div className="flex items-center gap-2">
        <SettingsDialog />
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon">
            <Code className="h-5 w-5" />
            <span className="sr-only">Toggle Debug View</span>
          </Button>
        </CollapsibleTrigger>
        {isUserLoading ? (
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        ) : user ? (
          <UserMenu />
        ) : (
          <AuthDialog />
        )}
      </div>
    </>
  );
}

export default function Home() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGuardrailResult, setSelectedGuardrailResult] = useState<any>(null);
  const [lastApiTransaction, setLastApiTransaction] = useState<ApiTransaction | null>(null);
  const [isStartingNewConversation, setIsStartingNewConversation] = useState(false);
  const hasUserOpenedConversationRef = useRef(false);

  const { searchDomains, systemPrompt, useGuardrails, isSettingsReady } = useSettings();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const creatingConversationRef = useRef(false);
  
  const handleGuardrailCheck = async (data: { user_prompt?: string; llm_response?: string }) => {
    if (!useGuardrails) return { is_safe: true, reason: 'guardrails_disabled' };

    try {
      console.log('[CLIENT] Calling guardrails with:', data);
      const result = await callGuardrails(data);
      console.log('[CLIENT] Guardrails result:', result);
      return result;
    } catch (error: any) {
      console.error("[CLIENT] Guardrails check failed:", error);
      const rawErrorMessage = error?.message || 'Failed to get a response from the guardrails service.';
      const normalizedMessage = rawErrorMessage.toLowerCase();
      const isTimeoutError =
        normalizedMessage.includes('deadline exceeded') ||
        normalizedMessage.includes('timed out') ||
        (normalizedMessage.includes('dkr') && normalizedMessage.includes('timeout'));

      toast({
        variant: 'destructive',
        title: isTimeoutError ? 'Guardrail Service Unresponsive' : 'Guardrail Service Error',
        description: isTimeoutError
          ? 'Guardrails service is starting. Please wait and retry.'
          : `Could not connect to the safety guardrail service: ${error.message}`,
      });
      return null;
    }
  };

  const createConversationRecord = useCallback(async () => {
    if (!user || !firestore || creatingConversationRef.current) return null;
    creatingConversationRef.current = true;
    const newConversationData: Omit<Conversation, 'id'> = {
      title: DEFAULT_CONVERSATION_TITLE,
      createdAt: serverTimestamp(),
    };
    const conversationsRef = collection(firestore, 'users', user.uid, 'conversations');
    try {
      const conversationRef = await addDocumentNonBlocking(conversationsRef, newConversationData);
      if (conversationRef) {
        const createdConversation = { id: conversationRef.id, ...newConversationData };
        hasUserOpenedConversationRef.current = true;
        setActiveConversation(createdConversation);
        setIsStartingNewConversation(false);
        return createdConversation;
      }
    } finally {
      creatingConversationRef.current = false;
    }
    return null;
  }, [firestore, user]);

  const startNewConversation = useCallback(() => {
    hasUserOpenedConversationRef.current = true;
    setIsStartingNewConversation(true);
    setActiveConversation(null);
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveConversation(null);
      hasUserOpenedConversationRef.current = false;
    }
    creatingConversationRef.current = false;
    setIsStartingNewConversation(false);
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !firestore) {
      return;
    }

    const conversationsRef = collection(firestore, 'users', user.uid, 'conversations');
    const q = query(conversationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          if (!isStartingNewConversation) {
            setActiveConversation(null);
          }
          return;
        }

        const latestConvo = snapshot.docs[0];
        const latestData = { id: latestConvo.id, ...(latestConvo.data() as Omit<Conversation, 'id'>) };

        if (!activeConversation) {
          if (!isStartingNewConversation && hasUserOpenedConversationRef.current) {
            setActiveConversation(latestData);
          }
          return;
        }

        const currentExists = snapshot.docs.find((docSnapshot) => docSnapshot.id === activeConversation.id);
        if (!currentExists && !isStartingNewConversation) {
          hasUserOpenedConversationRef.current = true;
          setActiveConversation(latestData);
        }
      },
      (error) => {
        console.error('Error fetching conversations:', error);
      }
    );

    return () => unsubscribe();
  }, [user, firestore, activeConversation?.id, isStartingNewConversation]);

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !activeConversation || !firestore) return null;
    return query(
        collection(firestore, 'users', user.uid, 'conversations', activeConversation.id, 'messages'),
        orderBy('createdAt', 'asc')
    );
  }, [user, activeConversation, firestore]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessageType>(messagesQuery);

  useEffect(() => {
    if (viewportRef.current) {
        viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSettingsReady || !user || !firestore) return;

    setIsLoading(true);

    let currentConversationId = activeConversation?.id;

    if (!currentConversationId) {
      const createdConversation = await createConversationRecord();
      if (!createdConversation) {
        toast({ variant: 'destructive', title: 'Error', description: 'Unable to start a new conversation.' });
        setIsLoading(false);
        return;
      }
      currentConversationId = createdConversation.id;
    }

    const conversationDocRef = doc(firestore, 'users', user.uid, 'conversations', currentConversationId);
    const messagesRef = collection(conversationDocRef, 'messages');

    const inputGuardrailResult = await handleGuardrailCheck({ user_prompt: input });
    if (inputGuardrailResult === null) {
      setIsLoading(false);
      return;
    }

    const isInputBlocked = !inputGuardrailResult.is_safe;
    
    const userMessageContent = isInputBlocked ? input : (inputGuardrailResult.prompt_processed || input);
    const userMessage: Omit<ChatMessageType, 'id'> = {
      role: 'user',
      content: userMessageContent,
      createdAt: serverTimestamp(),
      guardrailResult: inputGuardrailResult,
      isBlocked: isInputBlocked,
    };
    addDocumentNonBlocking(messagesRef, userMessage);

    if (
      !isInputBlocked &&
      (activeConversation?.title?.trim() === '' || activeConversation?.title === DEFAULT_CONVERSATION_TITLE)
    ) {
      const sanitizedForTitle = userMessageContent;
      void (async () => {
        try {
          const generatedTitle = await generateConversationTitle(sanitizedForTitle);
          const normalizedTitle = generatedTitle.trim();
          if (normalizedTitle && normalizedTitle !== activeConversation?.title) {
            updateDocumentNonBlocking(conversationDocRef, { title: normalizedTitle });
            setActiveConversation((previous) => {
              if (!previous || previous.id !== currentConversationId) {
                return previous;
              }
              return { ...previous, title: normalizedTitle };
            });
          }
        } catch (error) {
          console.error('[CLIENT] Failed to generate conversation title:', error);
        }
      })();
    }

    if (isInputBlocked) {
      setLastApiTransaction({ request: {user_prompt: input}, response: inputGuardrailResult });
    }
    setInput('');

    if (isInputBlocked) {
      setIsLoading(false);
      return;
    }

    const messageHistory = [...(messages || []), userMessage]
      .filter(m => !m.isBlocked)
      .map(({ role, content }) => ({ role, content: content || "" }));

    const sanitizedHistory = limitMessageHistorySize(messageHistory);

    const requestBody = {
      system: systemPrompt,
      messages: sanitizedHistory,
      search_domain_filter: searchDomains.length > 0 ? searchDomains : undefined,
    };

    try {
      console.log('[CLIENT] Sending request to /api/chat with body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[CLIENT] Received response from /api/chat with status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CLIENT] API Error Response Text:', errorText);
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[CLIENT] Successfully parsed JSON response from /api/chat');
      setLastApiTransaction({ request: requestBody, response: data });

      let aiResponseContent = data.choices[0].message.content;
      let references = mapSearchResultsToReferences(data.search_results);

      const outputGuardrailResult = await handleGuardrailCheck({ llm_response: aiResponseContent });

      if (outputGuardrailResult === null) {
        setIsLoading(false);
        return;
      }
      
      const isAiResponseBlocked = !outputGuardrailResult.is_safe;

      const assistantMessage: Omit<ChatMessageType, 'id'> = {
        role: 'assistant',
        content: isAiResponseBlocked ? "I cannot provide a response to this." : (outputGuardrailResult.llm_response_processed || aiResponseContent),
        createdAt: serverTimestamp(),
        references,
        guardrailResult: outputGuardrailResult,
        isBlocked: isAiResponseBlocked,
      };

      addDocumentNonBlocking(messagesRef, assistantMessage);

    } catch (error: any) {
      const rawErrorMessage = error?.message || 'Failed to get a response from the AI.';
      const normalizedMessage = rawErrorMessage.toLowerCase();
      // Updated error check to handle specific client-side parsing error
      const isJsonError = rawErrorMessage.includes('invalid json');
      const isTimeoutError =
        !isJsonError && (
            normalizedMessage.includes('deadline exceeded') ||
            normalizedMessage.includes('timed out') ||
            (normalizedMessage.includes('dkr') && normalizedMessage.includes('timeout'))
        );

      toast({
        variant: 'destructive',
        title: isJsonError ? 'API Error' : (isTimeoutError ? 'Request Timed Out' : 'API Error'),
        description: isJsonError 
          ? `Unexpected response from server. Check console for details.`
          : (isTimeoutError
            ? 'The AI service took too long to respond. Please try again in a few moments.'
            : rawErrorMessage),
      });
      setLastApiTransaction({ request: requestBody, response: { error: rawErrorMessage } });
    } finally {
      setIsLoading(false);
    }
  };
  
  const isChatDisabled = isLoading || !user;

  return (
    <SidebarProvider defaultOpen={false}>
      <SidebarAutoCollapse userId={user?.uid ?? undefined} />
      <Sidebar>
        <SidebarHeader>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <ConversationHistory
            activeConversation={activeConversation}
            onConversationSelect={(conversation) => {
              setIsStartingNewConversation(false);
              hasUserOpenedConversationRef.current = true;
              setActiveConversation(conversation);
            }}
            onCreateNew={startNewConversation}
          />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <Collapsible asChild>
            <div className="flex h-full flex-col">
              <header className="flex flex-col gap-4 border-b bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <HeaderContent />
              </header>

              <CollapsibleContent>
                {lastApiTransaction && (
                  <div className="border-b bg-muted/50 p-4">
                    <DebugView request={lastApiTransaction.request} response={lastApiTransaction.response} />
                  </div>
                )}
              </CollapsibleContent>

              <main className="flex-1 overflow-y-auto" ref={viewportRef}>
                <div className="space-y-4 p-4 pb-36">
                   {isLoadingMessages && !messages && (
                    <div className="flex h-full items-center justify-center">
                        <LoadingMessage />
                    </div>
                   )}
                   {!user && !isLoadingMessages ? (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                          <LogIn className="mb-4 h-16 w-16 text-primary" />
                          <h2 className="mb-2 text-2xl font-headline">Please Log In</h2>
                          <p className="mb-4 max-w-md text-muted-foreground">
                            To begin your secure and personalized health chat, please log in or create an account.
                          </p>
                          <AuthDialog />
                        </div>
                   ) : (!messages || messages.length === 0) && !isLoading && !isLoadingMessages ? (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                       <HeartPulse className="mb-4 h-16 w-16 text-blue-500" />
                      <h2 className="mb-2 text-2xl font-headline">Welcome to Safe Health Chat</h2>
                      <p className="max-w-md text-muted-foreground">
                        Your conversations are saved and organized here. Start a new one below.
                      </p>
                    </div>
                  ) : (
                    messages?.map((msg) => (
                      <ChatMessage 
                        key={msg.id} 
                        message={msg} 
                        onGuardrailClick={() => setSelectedGuardrailResult(msg.guardrailResult)}
                      />
                    ))
                  )}
                  {isLoading && (
                     <div className="flex items-start gap-4">
                        <LoadingMessage />
                    </div>
                  )}
                </div>
              </main>

              <footer className="sticky bottom-0 z-10 flex-shrink-0 border-t bg-card/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/75">
                <form onSubmit={handleSubmit} className="relative mx-auto max-w-2xl">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={user ? 'Ask anything...' : 'Please log in to start a conversation.'}
                    className="min-h-[52px] resize-none border-input bg-white pr-20 shadow-lg"
                    ref={inputRef}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    disabled={isChatDisabled}
                    rows={1}
                  />
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <Button type="submit" size="icon" disabled={isChatDisabled || !input.trim()}>
                      <Send className="h-5 w-5" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </form>
              </footer>
            </div>
          </Collapsible>
        </div>
      </SidebarInset>
      <GuardrailResultDialog 
        result={selectedGuardrailResult}
        isOpen={!!selectedGuardrailResult}
        onOpenChange={(open) => {
          if (!open) setSelectedGuardrailResult(null);
        }}
      />
    </SidebarProvider>
  );
}
