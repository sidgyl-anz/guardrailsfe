import {NextRequest, NextResponse} from 'next/server';
import {getCallableJSON, getHttpStatus} from 'genkit/context';
import {safeHealthChat, type ChatInput} from '@/ai/flows/chat';

export async function POST(req: NextRequest) {
  let input: ChatInput;
  try {
    input = (await req.json()) as ChatInput;
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json(
      {error: 'Invalid JSON body'},
      {status: 400}
    );
  }

  try {
    const {result} = await safeHealthChat.run(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling action:', error);
    return NextResponse.json(
      {error: getCallableJSON(error)},
      {status: getHttpStatus(error)}
    );
  }
}
