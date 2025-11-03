
"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { collection, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Send, HeartPulse, Code, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { type ChatMessageType, type Conversation } from '@/lib/types';
import { ChatMessage, LoadingMessage } from '@/components/chat-message';
import { SettingsDialog } from '@/components/settings-dialog';
import { safeHealthChat } from '@/ai/flows/chat';
import { GuardrailResultDialog } from '@/components/guardrail-result-dialog';
import { AuthDialog } from '@/components/auth-dialog';
import { UserMenu } from '@/components/user-menu';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DebugView } from '@/components/debug-view';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ApiTransaction = {
  request: any;
  response: any;
};

export default function Home() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGuardrailResult, setSelectedGuardrailResult] = useState<any>(null);
  const [lastApiTransaction, setLastApiTransaction] = useState<ApiTransaction | null>(null);
  const [isDebugViewVisible, setIsDebugViewVisible] = useState(false);
  
  const { searchDomains, systemPrompt, useGuardrails, isSettingsReady } = useSettings();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'conversations'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: conversations, isLoading: isLoadingConversations } = useCollection<Conversation>(conversationsQuery);

  useEffect(() => {
    if (!user) {
      setActiveConversation(null);
      return;
    }

    if (!activeConversation && conversations && conversations.length > 0) {
      setActiveConversation(conversations[0]);
      return;
    }

    if (
      activeConversation &&
      conversations &&
      conversations.length > 0 &&
      !conversations.some((conversation) => conversation.id === activeConversation.id)
    ) {
      setActiveConversation(conversations[0]);
    }
  }, [user, conversations, activeConversation]);

  // Fetch messages for the active conversation
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
  
  const createNewConversation = async () => {
    if (!user || !firestore) return;

    const newConversationData: Omit<Conversation, 'id'> = {
      title: 'New Conversation',
      createdAt: serverTimestamp(),
    };

    const conversationsRef = collection(firestore, 'users', user.uid, 'conversations');
    const conversationRef = await addDocumentNonBlocking(conversationsRef, newConversationData);

    if (conversationRef) {
      setActiveConversation({ id: conversationRef.id, ...newConversationData });
    }
  };

  useEffect(() => {
    if (!user || !firestore || isLoadingMessages) return;

    const conversationsRef = collection(firestore, 'users', user.uid, 'conversations');
    const q = query(conversationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        void createNewConversation();
        return;
      }

      if (!activeConversation) {
        const latestConvo = snapshot.docs[0];
        setActiveConversation({
          id: latestConvo.id,
          ...(latestConvo.data() as Omit<Conversation, 'id'>),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, firestore, isLoadingMessages, activeConversation]);


  const callGuardrails = async (data: { user_prompt?: string; llm_response?: string }) => {
    if (!useGuardrails) return { is_safe: true, reason: 'guardrails_disabled' };
  
    try {
      const response = await fetch('/api/guardrails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorDetails = `Guardrails API responded with status ${response.status}`;

        try {
          const errorData = await response.clone().json();
          errorDetails = errorData.error?.message || JSON.stringify(errorData);
        } catch (jsonError) {
          try {
            errorDetails = await response.text();
          } catch (textError) {
            console.error('Failed to read guardrails error response:', textError);
          }
        }

        throw new Error(errorDetails);
      }

      return await response.json();
    } catch (error: any) {
      console.error("Guardrails API error:", error);
      toast({
        variant: 'destructive',
        title: 'Guardrail Service Error',
        description: `Could not connect to the safety guardrail service: ${error.message}`,
      });
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSettingsReady || !user || !firestore) return;

    setIsLoading(true);

    let currentConversationId = activeConversation?.id;

    if (!currentConversationId) {
      if (!user) return;

      const newConversationData: Omit<Conversation, 'id'> = {
        title: input.substring(0, 40) || 'New Conversation',
        createdAt: serverTimestamp(),
      };

      const conversationRef = await addDocumentNonBlocking(
        collection(firestore, 'users', user.uid, 'conversations'),
        newConversationData
      );

      if (conversationRef) {
        currentConversationId = conversationRef.id;
        setActiveConversation({ id: currentConversationId, ...newConversationData });
      }
    }

    if (!currentConversationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create or find a conversation.' });
      setIsLoading(false);
      return;
    }

    const messagesRef = collection(
      firestore,
      'users',
      user.uid,
      'conversations',
      currentConversationId,
      'messages'
    );

    const inputGuardrailResult = await callGuardrails({ user_prompt: input });
    
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
    if (isInputBlocked) {
      setLastApiTransaction({ request: { user_prompt: input }, response: inputGuardrailResult });
    }
    setInput('');
    
    if (isInputBlocked) {
      setIsLoading(false);
      return;
    }

    const messageHistory = [...(messages || []), userMessage]
      .filter((message) => !message.isBlocked)
      .map(({ role, content }) => ({ role, content: content || '' }));

    const requestBody = {
      system: systemPrompt,
      messages: messageHistory,
      search_domain_filter: searchDomains.length > 0 ? searchDomains : undefined,
    };

    try {
      const data = await safeHealthChat(requestBody);
      setLastApiTransaction({ request: requestBody, response: data });

      let aiResponseContent = data.choices[0].message.content;
      const references =
        data.search_results?.map((result: any) => ({ url: result.url, title: result.title || result.url })) || [];

      const outputGuardrailResult = await callGuardrails({ llm_response: aiResponseContent });

      if (!outputGuardrailResult) {
        setIsLoading(false);
        return;
      }

      const isAiResponseBlocked = !outputGuardrailResult.is_safe;
      
      const assistantMessage: Omit<ChatMessageType, 'id'> = {
        role: 'assistant',
        content: isAiResponseBlocked
          ? 'I cannot provide a response to this.'
          : outputGuardrailResult.llm_response_processed || aiResponseContent,
        createdAt: serverTimestamp(),
        references,
        guardrailResult: outputGuardrailResult,
        isBlocked: isAiResponseBlocked,
      };
      
      addDocumentNonBlocking(messagesRef, assistantMessage);

    } catch (error: any) {
      const rawErrorMessage = error?.message || 'Failed to get a response from the AI.';
      const normalizedMessage = rawErrorMessage.toLowerCase();
      const isTimeoutError =
        normalizedMessage.includes('deadline exceeded') ||
        normalizedMessage.includes('timed out') ||
        (normalizedMessage.includes('dkr') && normalizedMessage.includes('timeout'));

      toast({
        variant: 'destructive',
        title: isTimeoutError ? 'Request Timed Out' : 'API Error',
        description: isTimeoutError
          ? 'The AI service took too long to respond. Please try again in a few moments.'
          : rawErrorMessage,
      });

      setLastApiTransaction({ request: requestBody, response: { error: rawErrorMessage } });
    } finally {
      setIsLoading(false);
    }
  };

  const isChatDisabled = isLoading || !user;

  const conversationPlaceholder = isLoadingConversations
    ? 'Loading conversations...'
    : conversations && conversations.length > 0
      ? 'Select a conversation'
      : 'No conversations yet';

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col gap-4 border-b bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-headline font-bold">Safe Health Chat</h1>
          </div>
          {user && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={activeConversation?.id ?? undefined}
                onValueChange={(conversationId) => {
                  const selectedConversation = conversations?.find((convo) => convo.id === conversationId);
                  if (selectedConversation) {
                    setActiveConversation(selectedConversation);
                  }
                }}
                disabled={isLoadingConversations || !conversations || conversations.length === 0}
              >
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder={conversationPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {conversations?.map((convo) => (
                    <SelectItem key={convo.id} value={convo.id}>
                      {convo.title || 'Untitled conversation'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createNewConversation} disabled={isLoading} variant="secondary">
                New Chat
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <SettingsDialog />
          <Button variant="ghost" size="icon" onClick={() => setIsDebugViewVisible(!isDebugViewVisible)}>
            <Code className="h-5 w-5" />
            <span className="sr-only">Toggle Debug View</span>
          </Button>
          {isUserLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <UserMenu />
          ) : (
            <AuthDialog />
          )}
        </div>
      </header>

      <Collapsible open={isDebugViewVisible} onOpenChange={setIsDebugViewVisible}>
        <CollapsibleContent>
          {lastApiTransaction && (
            <div className="border-b bg-muted/50 p-4">
              <DebugView request={lastApiTransaction.request} response={lastApiTransaction.response} />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <main className="flex-1 overflow-y-auto" ref={viewportRef}>
        <div className="space-y-4 p-4 pb-32">
          {isLoadingMessages && !messages && (
            <div className="flex h-full items-center justify-center">
              <LoadingMessage />
            </div>
          )}
          {!user && !isUserLoading ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <LogIn className="mb-4 h-16 w-16 text-primary" />
              <h2 className="mb-2 text-2xl font-headline">Please Log In</h2>
              <p className="mb-4 max-w-md text-muted-foreground">
                To begin your secure and personalized health chat, please log in or create an account.
              </p>
              <AuthDialog />
            </div>
          ) : messages?.length === 0 && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <HeartPulse className="mb-4 h-16 w-16 text-blue-500" />
              <h2 className="mb-2 text-2xl font-headline">Welcome to Safe Health Chat</h2>
              <p className="max-w-md text-muted-foreground">
                Your conversations are saved here. Start a new one below.
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
            <div className={cn(messages?.length === 0 && 'flex justify-center')}>
              <LoadingMessage />
            </div>
          )}
        </div>
      </main>

      <footer className="flex-shrink-0 border-t bg-card p-4">
        <form onSubmit={handleSubmit} className="relative mx-auto max-w-2xl">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user ? 'Ask anything...' : 'Please log in to start a conversation.'}
            className="min-h-[52px] resize-none border-input bg-white pr-20 shadow-lg"
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
      <GuardrailResultDialog
        result={selectedGuardrailResult}
        isOpen={!!selectedGuardrailResult}
        onOpenChange={(open) => {
          if (!open) setSelectedGuardrailResult(null);
        }}
      />
    </div>
  );
}
