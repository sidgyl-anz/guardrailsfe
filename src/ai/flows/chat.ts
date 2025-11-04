'use server';
/**
 * @fileoverview A flow that interacts with the Perplexity API for chat completions.
 *
 * This file defines a Genkit flow that takes a user's chat history and system prompt,
 * calls the Perplexity API, and returns the AI's response. The API key is handled
 * securely on the server-side.
 */

import {ai} from '@/ai/genkit';
import {defineModel, Message, Role} from 'genkit';
import {z} from 'zod';
import {googleAI} from '@genkit-ai/googleai';

// Define the schema for a single chat message from the client
const ClientMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

// Define the input schema for the chat flow
const ChatInputSchema = z.object({
  system: z.string().optional(),
  messages: z.array(ClientMessageSchema),
  search_domain_filter: z.array(z.string()).optional(),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

// Define the output schema
const ChatOutputSchema = z.any();
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// Define a custom Genkit model for Perplexity
const perplexitySonar = defineModel(
  {
    name: 'perplexity/sonar-pro',
    label: 'Perplexity Sonar Pro',
    supports: {
      generate: true,
      multiturn: true,
      tools: false,
      media: false,
      systemRole: true,
    },
    // We don't need to specify config, as we'll pass it in the flow.
  },
  async (request, streamingCallback) => {
    console.log('[FLOW] Perplexity model invoked.');
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error('[FLOW] FATAL: PERPLEXITY_API_KEY is not defined.');
      throw new Error('PERPLEXITY_API_KEY is not defined in environment variables.');
    }

    const systemPrompt = request.system;
    const messages = request.messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content.map(p => p.text).join(''),
    }));

    if (systemPrompt) {
      messages.unshift({role: 'system', content: systemPrompt});
    }
    
    // Extract search_domain_filter from custom config
    const searchDomainFilter = (request.config as any)?.search_domain_filter;

    const requestBody = {
      model: 'sonar-pro',
      messages: messages,
      ...(searchDomainFilter && searchDomainFilter.length > 0 && { search_domain_filter: searchDomainFilter }),
    };

    console.log('[FLOW] Sending request to Perplexity:', JSON.stringify(requestBody, null, 2));

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
      const errorText = await response.text();
      console.error('[FLOW] Perplexity API Error:', errorText);
      throw new Error(`Perplexity API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[FLOW] Received response from Perplexity.');


    // Perplexity provides choices, we'll take the first one.
    const choice = data.choices[0];
    const message = choice.message;

    return {
      candidates: [
        {
          index: 0,
          finishReason: choice.finish_reason,
          message: {
            role: 'model',
            content: [{text: message.content}],
          },
        },
      ],
      // Pass through usage and search_results in custom data
      custom: {
        usage: data.usage,
        search_results: data.search_results,
      },
    };
  }
);


// Define the Genkit flow using the Perplexity model
export const safeHealthChat = ai.defineFlow(
  {
    name: 'safeHealthChatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    // Transform input messages to Genkit's Message format
    const history: Message[] = input.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      content: [{ text: msg.content }],
    }));

    const response = await ai.generate({
      model: perplexitySonar, // Use our custom Perplexity model
      prompt: history,
      config: {
        // Pass system prompt and search domains through the config
        system: input.system,
        search_domain_filter: input.search_domain_filter,
      },
    });

    const aiResponse = response.output;
    const customData = response.custom;

    // Return a structured response similar to the original design
    return {
      choices: [{ message: { content: aiResponse?.content[0].text, role: 'assistant' } }],
      search_results: customData?.search_results,
    };
  }
);
