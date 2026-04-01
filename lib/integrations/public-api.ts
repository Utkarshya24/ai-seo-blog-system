import { NextResponse } from 'next/server';

const CORS_ORIGIN = process.env.PUBLIC_CONTENT_CORS_ORIGIN || '*';

export function withPublicApiCors(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-content-api-key');
  response.headers.set('Vary', 'Origin');
  return response;
}

export function handlePublicApiOptions(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return withPublicApiCors(response);
}
