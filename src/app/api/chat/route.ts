import {appRoute} from '@genkit-ai/next';
import {safeHealthChat} from '@/ai/flows/chat';

export const POST = appRoute(safeHealthChat);
