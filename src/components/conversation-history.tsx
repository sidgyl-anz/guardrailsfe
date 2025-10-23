
"use client";

import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { type Conversation } from '@/lib/types';
import { Button } from './ui/button';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from './ui/sidebar';
import { Skeleton } from './ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface ConversationHistoryProps {
  activeConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
}

export function ConversationHistory({
  activeConversation,
  onConversationSelect,
  onNewConversation,
}: ConversationHistoryProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const conversationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'conversations'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);

  const handleDelete = (conversationId: string) => {
    if (!user || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'conversations', conversationId);
    deleteDocumentNonBlocking(docRef);
  };


  return (
    <>
      <SidebarHeader>
        <Button className="w-full" onClick={onNewConversation}>
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {isLoading && (
            <>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </>
          )}
          {conversations?.map((convo) => (
            <SidebarMenuItem key={convo.id} className="relative">
              <SidebarMenuButton
                isActive={activeConversation?.id === convo.id}
                onClick={() => onConversationSelect(convo)}
                className="w-full justify-start pr-10"
              >
                <span className="truncate flex items-center gap-2">
                    <MessageSquare size={16} /> {convo.title}
                </span>
              </SidebarMenuButton>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your conversation and all of its messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(convo.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
    </>
  );
}
