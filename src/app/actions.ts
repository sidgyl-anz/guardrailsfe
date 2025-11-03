"use server";

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
