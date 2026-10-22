import { handleQuestions } from '../../backend/questionsHandler.ts';

// Vercel Function adapter (Web standard Request/Response). Deployed in M5.
async function handle(request: Request): Promise<Response> {
  const result = await handleQuestions({
    method: request.method,
    contentType: request.headers.get('content-type'),
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    body: request.method === 'POST' ? await request.text() : '',
  });
  return new Response(JSON.stringify(result.json), {
    status: result.status,
    headers: result.headers,
  });
}

export const GET = handle;
export const POST = handle;
