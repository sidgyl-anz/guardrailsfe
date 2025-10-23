'use server';
/**
 * @fileoverview A flow that interacts with the Perplexity API for chat completions.
 *
 * This file defines a Genkit flow that takes a user's chat history and system prompt,
 * calls the Perplexity API, and returns the AI's response. The API key is handled
 * securely on the server-side.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for a single chat message
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

// Define the input schema for the chat flow
const ChatInputSchema = z.object({
  system: z.string().optional(),
  messages: z.array(ChatMessageSchema),
  search_domain_filter: z.array(z.string()).optional(),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

// Define the output schema, which can be any JSON for flexibility
const ChatOutputSchema = z.any();
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// Define the Genkit flow
const chatFlow = ai.defineFlow(
  {
    name: 'safeHealthChatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not defined in environment variables.');
    }

    const requestBody = {
      model: 'sonar-pro',
      ...input,
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Perplexity API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    // Pass both choices and search_results back to the client
    return {
      choices: data.choices,
      search_results: data.search_results,
    };
  }
);

// Export a wrapper function to be used in the application
export async function safeHealthChat(input: ChatInput): Promise<ChatOutput> {
  return await chatFlow(input);
}
