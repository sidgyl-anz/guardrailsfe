"use server";

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

const generateTitleFromFirstWords = (text: string, wordLimit = 5): string => {
  const words = text
    .split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean)
    .slice(0, wordLimit);

  if (words.length === 0) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const titleCase = words
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

  return generateTitleFromFirstWords(sanitizedQuestion);
}
