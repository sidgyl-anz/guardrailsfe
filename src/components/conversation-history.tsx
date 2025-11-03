
"use client";

import { useState } from 'react';
import { Plus, MessageSquare, Trash2, MoreHorizontal } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { type Conversation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDistanceToNow } from 'date-fns';


interface ConversationHistoryProps {
  activeConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onCreateNew: () => void;
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: { conversation: Conversation; isActive: boolean; onSelect: () => void; onDelete: () => void; }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const getRelativeTime = () => {
    if (conversation.createdAt && typeof (conversation.createdAt as any).toDate === 'function') {
      try {
        return formatDistanceToNow((conversation.createdAt as any).toDate(), { addSuffix: true });
      } catch (error) {
        return 'a while ago';
      }
    }
    return 'just now';
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-sm",
          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/80'
        )}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 truncate">
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate">{conversation.title}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
           <span className={cn("text-xs text-muted-foreground/80", isActive && "text-sidebar-accent-foreground/80")}>{getRelativeTime()}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-red-500">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation titled &quot;{conversation.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const ConversationSkeleton = () => (
    <div className="flex flex-col gap-2 px-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full opacity-80" />
    </div>
);


export function ConversationHistory({
  activeConversation,
  onConversationSelect,
  onCreateNew,
}: ConversationHistoryProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const conversationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'conversations'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'conversations', conversationId);
    try {
      // Use non-blocking delete for UI responsiveness
      deleteDocumentNonBlocking(docRef);
      toast({
        title: 'Conversation Deleted',
        description: 'The conversation has been successfully deleted.',
      });
      // If the active conversation is the one being deleted, clear it.
      if (activeConversation?.id === conversationId) {
        const firstConversation = conversations?.find(c => c.id !== conversationId);
        if(firstConversation) {
            onConversationSelect(firstConversation);
        } else {
            onCreateNew();
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Conversation',
        description: error.message,
      });
    }
  };
  

  if (!user) {
    return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <p className="text-sm text-sidebar-foreground/80">Log in to see your conversation history.</p>
        </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-sidebar-border p-2">
        <h2 className="px-2 text-lg font-headline font-semibold tracking-tight">History</h2>
        <Button variant="ghost" size="icon" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">New Chat</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading ? (
            <ConversationSkeleton />
          ) : conversations && conversations.length > 0 ? (
            conversations.map((convo) => (
              <ConversationItem
                key={convo.id}
                conversation={convo}
                isActive={activeConversation?.id === convo.id}
                onSelect={() => onConversationSelect(convo)}
                onDelete={() => handleDeleteConversation(convo.id)}
              />
            ))
          ) : (
            <div className="p-4 text-center text-sm text-sidebar-foreground/80">
              No conversations yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
