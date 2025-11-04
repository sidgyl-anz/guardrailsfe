
'use server';
/**
 * @fileoverview A flow that interacts with the Perplexity API for chat completions.
 *
 * This file defines a Genkit flow that takes a user's chat history and system prompt,
 * calls the Perplexity API, and returns the AI's response. The API key is handled
 * securely on the server-side.
 */

import {ai} from '@/ai/genkit';
import {Message} from 'genkit';
import {z} from 'zod';

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
type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Define the output schema
const ChatOutputSchema = z.any();
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// Define a custom Genkit model for Perplexity
type PerplexityMessage = ClientMessage | {role: 'system'; content: string};

const perplexitySonar = ai.defineModel(
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

    const config = request.config as
      | {
          system?: string;
          clientMessages?: ClientMessage[];
          search_domain_filter?: string[];
        }
      | undefined;

    const systemPrompt =
      typeof config?.system === 'string' && config.system.trim().length > 0
        ? config.system
        : undefined;

    const clientMessages = config?.clientMessages ?? [];
    const alternatingMessages: ClientMessage[] = [];
    for (const message of clientMessages) {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = message.content ?? '';
      if (content.trim().length === 0) {
        continue;
      }

      if (role === 'assistant' && alternatingMessages.length === 0) {
        // Drop leading assistant messages to satisfy Perplexity's alternating rule.
        continue;
      }

      const lastMessage = alternatingMessages[alternatingMessages.length - 1];
      if (lastMessage && lastMessage.role === role) {
        // Replace the previous message of the same role so the latest message is kept.
        alternatingMessages[alternatingMessages.length - 1] = {role, content};
      } else {
        alternatingMessages.push({role, content});
      }
    }

    const messages: PerplexityMessage[] = alternatingMessages.map(message => ({
      role: message.role,
      content: message.content,
    }));

    if (messages.length === 0) {
      console.error('[FLOW] No non-empty client messages were provided.');
      throw new Error('At least one non-empty user message is required.');
    }

    if (systemPrompt) {
      messages.unshift({role: 'system', content: systemPrompt});
    }
    
    // Extract search_domain_filter from custom config
    const searchDomainFilter = config?.search_domain_filter;

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

    const rawResponseText = await response.text();
    console.log('[FLOW] Raw response from Perplexity:', rawResponseText);

    if (!response.ok) {
      console.error('[FLOW] Perplexity API Error:', rawResponseText);
      throw new Error(
        `Perplexity API responded with status ${response.status}: ${rawResponseText}`
      );
    }

    let data: any;
    try {
      data = JSON.parse(rawResponseText);
    } catch (parseError) {
      console.error('[FLOW] Failed to parse Perplexity response as JSON:', parseError);
      throw new Error('Failed to parse Perplexity response JSON.');
    }
    console.log('[FLOW] Received response from Perplexity.');

    if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('[FLOW] Missing choices in Perplexity response:', data);
      throw new Error('Perplexity response did not include any choices.');
    }

    const choice = data.choices[0];
    const message = choice?.message;

    if (!message || typeof message.content !== 'string') {
      console.error('[FLOW] Missing assistant message in Perplexity response:', data);
      throw new Error('Perplexity response did not include an assistant message.');
    }

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
      // Pass through usage, search_results, and resolved message content in custom data
      custom: {
        usage: data.usage,
        search_results: data.search_results,
        assistant_message: message.content,
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
        // Pass system prompt, client messages, and search domains through the config
        system: input.system,
        clientMessages: input.messages,
        search_domain_filter: input.search_domain_filter,
      },
    });

    const aiResponse = response.output;
    const customData = response.custom ?? {};

    const extractTextFromMessage = (message: any): string | undefined => {
      if (!message || !Array.isArray(message.content)) {
        return undefined;
      }

      for (const part of message.content) {
        if (typeof part?.text === 'string' && part.text.trim().length > 0) {
          return part.text;
        }
      }

      return undefined;
    };

    const assistantText =
      extractTextFromMessage(aiResponse) ??
      extractTextFromMessage(response.candidates?.[0]?.message) ??
      (typeof customData.assistant_message === 'string'
        ? customData.assistant_message
        : undefined);

    if (!assistantText) {
      console.error('[FLOW] Unable to determine assistant text from Perplexity response.', {
        output: aiResponse,
        candidates: response.candidates,
        custom: customData,
      });
      throw new Error('Assistant response content was missing.');
    }

    // Return a structured response similar to the original design
    return {
      choices: [{message: {content: assistantText, role: 'assistant'}}],
      search_results: customData?.search_results,
    };
  }
);
