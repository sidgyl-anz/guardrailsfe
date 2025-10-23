
"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Send, HeartPulse, Code, LogIn, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { type ChatMessageType, type Conversation } from '@/lib/types';
import { ChatMessage, LoadingMessage } from '@/components/chat-message';
import { SettingsDialog } from '@/components/settings-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DebugView } from '@/components/debug-view';
import { safeHealthChat } from '@/ai/flows/chat';
import { GuardrailResultDialog } from '@/components/guardrail-result-dialog';
import { AuthDialog } from '@/components/auth-dialog';
import { UserMenu } from '@/components/user-menu';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ConversationHistory } from '@/components/conversation-history';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const GUARDRAILS_URL = "/api/guardrails";
const GUARDRAIL_TIMEOUT = 120000; // 2 minutes

export default function Home() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastApiTransaction, setLastApiTransaction] = useState<{ request: any; response: any; } | null>(null);
  const [selectedGuardrailResult, setSelectedGuardrailResult] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const { searchDomains, systemPrompt, useGuardrails, isSettingsReady } = useSettings();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);

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
    if(conversationRef) {
        setActiveConversation({ id: conversationRef.id, ...newConversationData });
    }
  };


  const callGuardrails = async (data: { user_prompt?: string; llm_response?: string }) => {
    if (!useGuardrails) return { is_safe: true, reason: 'guardrails_disabled' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GUARDRAIL_TIMEOUT);

    try {
      const response = await fetch(GUARDRAILS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        // Handle server-side timeouts (like 504) gracefully
        if (response.status === 504) {
             toast({
                variant: 'destructive',
                title: 'Guardrail Service Timeout',
                description: 'The safety check took too long. The service may be starting up. Please try again in a moment.',
            });
            return null; // indicate failure
        }
        throw new Error(`Guardrails API responded with status ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        toast({
            variant: 'destructive',
            title: 'Guardrail Service Timeout',
            description: 'The safety check took too long. The service may be starting up. Please try again in a moment.',
        });
        return null;
      }
      console.error("Guardrails API error:", error);
      toast({
        variant: 'destructive',
        title: 'Guardrail Service Error',
        description: 'Could not connect to the safety guardrail service. Please try again later.',
      });
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSettingsReady || !user || !firestore) return;

    setIsLoading(true);
    setIsDebugOpen(false);

    let currentConversationId = activeConversation?.id;

    // Create a new conversation if one doesn't exist
    if (!currentConversationId) {
        if (!user) return;
        const newConversationData = { title: input.substring(0, 40), createdAt: serverTimestamp() };
        const conversationRef = await addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'conversations'), newConversationData);
        if(conversationRef) {
            currentConversationId = conversationRef.id;
            setActiveConversation({ id: currentConversationId, ...newConversationData });
        }
    }
    
    if (!currentConversationId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create or find a conversation.' });
        setIsLoading(false);
        return;
    }

    const messagesRef = collection(firestore, 'users', user.uid, 'conversations', currentConversationId, 'messages');

    // 1. Handle user's message and guardrail
    const inputGuardrailResult = await callGuardrails({ user_prompt: input });
    
    // If timeout or other error, stop processing
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
      setLastApiTransaction({ request: {user_prompt: input}, response: inputGuardrailResult });
      setIsDebugOpen(true);
    }
    setInput('');
    
    if (isInputBlocked) {
      setIsLoading(false);
      return;
    }

    // 2. Call the AI
    const messageHistory = [...(messages || []), userMessage]
      .filter(m => !m.isBlocked)
      .map(({ role, content }) => ({ role, content: content || "" }));

    const requestBody = {
      system: systemPrompt,
      messages: messageHistory,
      search_domain_filter: searchDomains.length > 0 ? searchDomains : undefined,
    };

    try {
      const data = await safeHealthChat(requestBody);
      setLastApiTransaction({ request: requestBody, response: data });
      setIsDebugOpen(true);

      let aiResponseContent = data.choices[0].message.content;
      // Correctly map search_results to references
      let references = data.search_results?.map((r: any) => ({ uri: r.url, title: r.title || r.url })) || [];

      // 3. Handle AI response and guardrail
      const outputGuardrailResult = await callGuardrails({ llm_response: aiResponseContent });

      // If timeout or other error, we can still show the AI response but without guardrail info
      const isAiResponseBlocked = !outputGuardrailResult || !outputGuardrailResult.is_safe;
      
      const assistantMessage: Omit<ChatMessageType, 'id'> = {
        role: 'assistant',
        content: isAiResponseBlocked ? "I cannot provide a response to this." : (outputGuardrailResult?.llm_response_processed || aiResponseContent),
        createdAt: serverTimestamp(),
        references,
        guardrailResult: outputGuardrailResult,
        isBlocked: isAiResponseBlocked,
      };
      
      addDocumentNonBlocking(messagesRef, assistantMessage);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Failed to get a response from the AI.',
      });
      setLastApiTransaction({ request: requestBody, response: { error: error.message } });
      setIsDebugOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isChatDisabled = isLoading || !user;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <ConversationHistory 
            activeConversation={activeConversation}
            onConversationSelect={setActiveConversation}
            onNewConversation={createNewConversation}
          />
        </Sidebar>
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b bg-card z-10 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <SidebarTrigger>
                        <Menu />
                    </SidebarTrigger>
                    <h1 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
                    <HeartPulse />
                    Safe Health Chat
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <SettingsDialog />
                    {isUserLoading ? (
                    <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
                    ) : user ? (
                    <UserMenu />
                    ) : (
                    <AuthDialog />
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-32" ref={viewportRef}>
            <div className="p-4 space-y-4">
                {isLoadingMessages && !messages && (
                    <div className="flex justify-center p-8"><LoadingMessage /></div>
                )}
                {!user && !isUserLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[60vh]">
                        <LogIn className="h-16 w-16 text-primary mb-4" />
                        <h2 className="text-2xl font-headline mb-2">Please Log In</h2>
                        <p className="max-w-md text-muted-foreground mb-4">
                        To begin your secure and personalized health chat, please log in or create an account.
                        </p>
                        <AuthDialog />
                    </div>
                ) : messages?.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[60vh]">
                    <HeartPulse className="h-16 w-16 text-primary mb-4" />
                    <h2 className="text-2xl font-headline mb-2">Welcome to Safe Health Chat</h2>
                    <p className="max-w-md text-muted-foreground">
                        Your conversations are saved here. Start a new one below or select a previous chat from the sidebar.
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
                {isLoading && <LoadingMessage />}
            </div>
            </main>

            <footer className="flex-shrink-0 p-4 border-t bg-card z-10">
            {lastApiTransaction && (
                <Collapsible open={isDebugOpen} onOpenChange={setIsDebugOpen} className="mb-4">
                <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                    <Code className="h-4 w-4 mr-2" />
                    Last API Transaction
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <DebugView 
                    request={lastApiTransaction.request} 
                    response={lastApiTransaction.response} 
                    />
                </CollapsibleContent>
                </Collapsible>
            )}
            <form onSubmit={handleSubmit} className="relative">
                <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={user ? "Ask anything..." : "Please log in to start a conversation."}
                className="pr-20 min-h-[52px] resize-none"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                    }
                }}
                disabled={isChatDisabled}
                rows={1}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button type="submit" size="icon" disabled={isChatDisabled || !input.trim()}>
                    <Send className="h-5 w-5" />
                    <span className="sr-only">Send</span>
                </Button>
                </div>
            </form>
            </footer>
        </div>
      </SidebarProvider>
      <GuardrailResultDialog
        result={selectedGuardrailResult}
        isOpen={!!selectedGuardrailResult}
        onOpenChange={(open) => {
            if (!open) setSelectedGuardrailResult(null)
        }}
      />
    </div>
  );
}

    