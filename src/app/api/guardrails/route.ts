
import {NextRequest, NextResponse} from 'next/server';

const DEFAULT_GUARDRAILS_URL =
  'https://guardrails-675059836631.us-central1.run.app/process';

function buildRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function serializeForLog(payload: unknown) {
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) {
      return '[empty json body]';
    }

    if (serialized.length <= 1000) {
      return serialized;
    }

    return `${serialized.slice(0, 1000)}...<truncated ${serialized.length - 1000} chars>`;
  } catch (error) {
    return `<<unserializable payload: ${(error as Error).message}>>`;
  }
}

export async function POST(req: NextRequest) {
  const requestId = buildRequestId();
  try {
    const body = await req.json();
    const guardrailsUrl = process.env.GUARDRAILS_URL ?? DEFAULT_GUARDRAILS_URL;

    console.log('[Guardrails API]', requestId, 'Incoming request', {
      method: req.method,
      url: req.url,
      guardrailsUrl,
    });
    console.log('[Guardrails API]', requestId, 'Request body preview', serializeForLog(body));

    if (!guardrailsUrl) {
      console.error('[Guardrails API]', requestId, 'Guardrails URL is not configured');
      return NextResponse.json({error: 'Guardrails service URL is not configured.'}, {status: 500});
    }

    const guardrailResponse = await fetch(guardrailsUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!guardrailResponse.ok) {
      const errorText = await guardrailResponse.text();
      console.error('[Guardrails API]', requestId, 'Non-OK response from guardrails service', {
        status: guardrailResponse.status,
        statusText: guardrailResponse.statusText,
        body: errorText,
      });
      return NextResponse.json(
        {
          error: 'Guardrails service error',
          status: guardrailResponse.status,
          details: errorText,
        },
        {status: guardrailResponse.status},
      );
    }

    const data = await guardrailResponse.json();
    console.log('[Guardrails API]', requestId, 'Successful response from guardrails service');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Guardrails API]', requestId, 'Unhandled error', {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json({error: 'Internal Server Error', details: error.message}, {status: 500});
  }
}
