"use server";

import { ai } from '@/ai/genkit';
import type { Message } from 'genkit';
import { DEFAULT_CONVERSATION_TITLE } from '@/lib/conversation-titles';

export async function callGuardrails(data: { user_prompt?: string; llm_response?: string }) {
    const GUARDRAILS_URL = "https://guardrails-675059836631.us-central1.run.app/process";
  
    if (!GUARDRAILS_URL) {
      throw new Error('Guardrails service URL is not configured.');
    }
  
    const guardrailResponse = await fetch(GUARDRAILS_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    });
  
    if (!guardrailResponse.ok) {
        const errorText = await guardrailResponse.text();
        console.error('Guardrails service error:', errorText);
        throw new Error(`Guardrails service error: ${guardrailResponse.status} ${errorText}`);
    }
  
    return await guardrailResponse.json();
}

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

const normalizeTitle = (rawTitle: string | undefined, fallbackSource: string): string => {
  const baseTitle = rawTitle?.replace(/["“”]+/g, '').replace(/[:;,.!?]+$/g, '').trim();
  const cleanedTitle = baseTitle && baseTitle.length > 0 ? baseTitle : fallbackSource;

  if (!cleanedTitle) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const words = cleanedTitle
    .split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  let limitedWords = words.slice(0, Math.max(3, Math.min(words.length, 5)));

  if (limitedWords.length < 3) {
    const fallbackWords = fallbackSource
      .split(/\s+/)
      .map(word => word.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (fallbackWords.length >= 3) {
      limitedWords = fallbackWords.slice(0, 5);
    }
  }
  const titleCase = limitedWords
    .map(word => {
      if (word.toUpperCase() === word) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  return titleCase.length > 0 ? titleCase : DEFAULT_CONVERSATION_TITLE;
};

export async function generateConversationTitle(question: string): Promise<string> {
  const sanitizedQuestion = question.replace(/\s+/g, ' ').trim();

  if (!sanitizedQuestion) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const instructions =
    'Summarize the following user question into a concise conversation title. ' +
    'Respond with a 3 to 5 word title in Title Case without quotation marks or trailing punctuation.';

  const prompt: Message[] = [
    {
      role: 'user',
      content: [
        {
          text: `${instructions}\n\nQuestion: ${sanitizedQuestion}`,
        },
      ],
    },
  ];

  try {
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt,
    });

    const modelTitle =
      extractTextFromMessage(response.output) ??
      extractTextFromMessage(response.candidates?.[0]?.message);

    return normalizeTitle(modelTitle, sanitizedQuestion);
  } catch (error) {
    console.error('[SERVER] Failed to generate conversation title with Gemini:', error);
    return normalizeTitle(undefined, sanitizedQuestion);
  }
}
