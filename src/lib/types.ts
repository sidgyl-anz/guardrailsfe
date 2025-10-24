
import { FieldValue } from "firebase/firestore";

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: FieldValue;
  guardrailResult?: any;
  isBlocked?: boolean;
  references?: { title: string; url: string }[];
}

export interface Conversation {
    id: string;
    title: string;
    createdAt: FieldValue;
}

export type ChatMessageType = ChatMessage;
