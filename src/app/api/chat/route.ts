
import {NextRequest, NextResponse} from 'next/server';
import {safeHealthChat, type ChatInput} from '@/ai/flows/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body: ChatInput = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        {error: 'Messages are required in the request body.'},
        {status: 400}
      );
    }
    
    const aiResponse = await safeHealthChat(body);

    return NextResponse.json(aiResponse);
  } catch (error: any) {
    console.error('Error in chat API route:', error);
    return NextResponse.json(
      {error: {message: error.message || 'An unknown error occurred.'}},
      {status: 500}
    );
  }
}
