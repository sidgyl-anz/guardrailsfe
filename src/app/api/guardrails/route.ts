
import {NextRequest, NextResponse} from 'next/server';

const GUARDRAILS_URL = process.env.GUARDRAILS_URL || "https://guardrails-675059836631.us-central1.run.app/process";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!GUARDRAILS_URL) {
      return NextResponse.json({error: 'Guardrails service URL is not configured.'}, {status: 500});
    }

    const guardrailResponse = await fetch(GUARDRAILS_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!guardrailResponse.ok) {
        const errorText = await guardrailResponse.text();
        return NextResponse.json({
            error: 'Guardrails service error',
            status: guardrailResponse.status,
            details: errorText,
        }, { status: guardrailResponse.status });
    }

    const data = await guardrailResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({error: 'Internal Server Error', details: error.message}, {status: 500});
  }
}
