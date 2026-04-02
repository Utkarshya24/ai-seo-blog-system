const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GenerateGeminiImageInput {
  prompt: string;
  width?: number;
  height?: number;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiResponsePayload {
  error?: { message?: string };
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return key;
}

function getImageModelCandidates(): string[] {
  return (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

function enhancePrompt(prompt: string, width: number, height: number): string {
  return `
${prompt}

Constraints:
- Photorealistic or high-quality digital illustration based on topic.
- No watermark, no logo, no gibberish text.
- Keep composition suitable for ${width}x${height} aspect ratio.
`.trim();
}

function extractInlineImage(payload: GeminiResponsePayload): string | null {
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  for (const part of parts) {
    const data = part.inlineData?.data || part.inline_data?.data;
    const mimeType = part.inlineData?.mimeType || part.inline_data?.mime_type || 'image/png';
    if (data) {
      return `data:${mimeType};base64,${data}`;
    }
  }
  return null;
}

export async function generateGeminiImage(input: GenerateGeminiImageInput): Promise<string> {
  const apiKey = getGeminiApiKey();
  const width = Math.max(256, Math.min(1536, Number(input.width || 1024)));
  const height = Math.max(256, Math.min(1536, Number(input.height || 1024)));
  const prompt = enhancePrompt(input.prompt.trim(), width, height);

  if (!prompt) {
    throw new Error('Prompt is required.');
  }

  const models = getImageModelCandidates();
  const requestBodies = [
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    },
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    },
  ];

  let lastError: string | null = null;

  for (const model of models) {
    for (const body of requestBodies) {
      const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as GeminiResponsePayload;

      if (!response.ok) {
        const message = payload.error?.message || `Gemini request failed with status ${response.status}`;
        lastError = `${model}: ${message}`;
        continue;
      }

      const imageDataUrl = extractInlineImage(payload);
      if (imageDataUrl) {
        return imageDataUrl;
      }

      const textPart = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      lastError = `${model}: image not returned${textPart ? ` (${textPart})` : ''}`;
    }
  }

  throw new Error(lastError || 'Gemini image generation failed.');
}
