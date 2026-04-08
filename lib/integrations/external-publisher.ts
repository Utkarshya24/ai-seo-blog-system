export interface ExternalPostPayload {
  id: string;
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageDetails: Record<string, unknown> | null;
  status: string;
  publishedAt: string | null;
  keyword: string | null;
  source: string;
}

export interface PublishExternalResult {
  ok: boolean;
  status: number;
  responseText: string;
}

export async function publishToExternalWebhook(
  webhookUrl: string,
  payload: ExternalPostPayload,
  secret?: string
): Promise<PublishExternalResult> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-webhook-secret': secret } : {}),
      'x-source-system': 'ai-seo-blog-system',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    responseText,
  };
}
