
"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { collection, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Send, Code, LogIn, HeartPulse, Menu } from 'lucide-react';
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
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

type ApiTransaction = {
  request: any;
  response: any;
};

function HeaderContent() {
  const { isMobile, toggleSidebar } = useSidebar();
  const { isUserLoading, user } = useUser();

  return (
    <>
      <div className="flex items-center gap-2">
        {isMobile && user && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu />
            <span className="sr-only">Toggle History</span>
          </Button>
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
  
  const { searchDomains, systemPrompt, useGuardrails, isSettingsReady } = useSettings();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);
  
  const handleGuardrailCheck = async (data: { user_prompt?: string; llm_response?: string }) => {
    if (!useGuardrails) return { is_safe: true, reason: 'guardrails_disabled' };

    const guardrailsUrl = '/api/guardrails';

    try {
      const response = await fetch(guardrailsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorJson.details || errorText;
        } catch (e) {
          // Not a JSON response, use the raw text
        }
        throw new Error(errorDetails);
      }

      return await response.json();
    } catch (error: any) {
      console.error("Guardrails check failed:", error);
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

  // Auto-select or create a conversation on login
  useEffect(() => {
    if (user && !activeConversation && firestore) {
      const conversationsRef = collection(firestore, 'users', user.uid, 'conversations');
      const q = query(conversationsRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const latestConvo = snapshot.docs[0];
          setActiveConversation({ id: latestConvo.id, ...(latestConvo.data() as Omit<Conversation, 'id'>) });
        } else {
          createNewConversation();
        }
      }, (error) => {
        console.error("Error fetching conversations:", error);
        // Let other UI parts handle permission errors.
      });
      return () => unsubscribe();
    } else if (!user) {
      setActiveConversation(null);
    }
  }, [user, firestore]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSettingsReady || !user || !firestore) return;

    setIsLoading(true);

    let currentConversationId = activeConversation?.id;

    if (!currentConversationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'No active conversation found.' });
      setIsLoading(false);
      return;
    }

    const messagesRef = collection(firestore, 'users', user.uid, 'conversations', currentConversationId, 'messages');

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

    const requestBody = {
      system: systemPrompt,
      messages: messageHistory,
      search_domain_filter: searchDomains.length > 0 ? searchDomains : undefined,
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API responded with status ${response.status}`);
      }

      const data = await response.json();
      setLastApiTransaction({ request: requestBody, response: data });

      let aiResponseContent = data.choices[0].message.content;
      let references = data.search_results?.map((r: any) => ({ url: r.url, title: r.title || r.url })) || [];

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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <ConversationHistory
            activeConversation={activeConversation}
            onConversationSelect={setActiveConversation}
            onCreateNew={createNewConversation}
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
                <div className="space-y-4 p-4 pb-32">
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
                   ) : messages?.length === 0 && !isLoading ? (
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
                    <LoadingMessage />
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
