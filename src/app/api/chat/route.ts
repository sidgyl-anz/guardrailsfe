import {runFlow} from '@genkit-ai/next';
import {safeHealthChat} from '@/ai/flows/chat';

export const POST = runFlow(safeHealthChat);
