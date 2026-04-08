import crypto from 'crypto';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export type CloudinaryImageDetails = {
  secureUrl: string;
  publicId: string;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  resourceType: string | null;
  createdAt: string | null;
  originalFilename: string | null;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  resource_type?: string;
  created_at?: string;
  original_filename?: string;
};

function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = String(process.env.CLOUDINARY_UPLOAD_FOLDER || 'seo-blog/posts').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  return { cloudName, apiKey, apiSecret, folder };
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function mapUploadResponse(json: CloudinaryUploadResponse): CloudinaryImageDetails {
  return {
    secureUrl: json.secure_url || '',
    publicId: json.public_id || '',
    width: typeof json.width === 'number' ? json.width : null,
    height: typeof json.height === 'number' ? json.height : null,
    format: json.format || null,
    bytes: typeof json.bytes === 'number' ? json.bytes : null,
    resourceType: json.resource_type || null,
    createdAt: json.created_at || null,
    originalFilename: json.original_filename || null,
  };
}

export async function uploadImageToCloudinary(params: {
  file: File;
  publicId?: string;
  folder?: string;
}): Promise<CloudinaryImageDetails> {
  const { cloudName, apiKey, apiSecret, folder: defaultFolder } = getCloudinaryConfig();
  const folder = (params.folder || defaultFolder).trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = String(params.publicId || '').trim();

  if (!params.file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  const signPayload: Record<string, string | number> = {
    timestamp,
    folder,
  };
  if (publicId) {
    signPayload.public_id = publicId;
  }

  const signature = signCloudinaryParams(signPayload, apiSecret);

  const form = new FormData();
  form.append('file', params.file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  if (publicId) {
    form.append('public_id', publicId);
  }
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${responseText}`);
  }

  let json: CloudinaryUploadResponse;
  try {
    json = JSON.parse(responseText) as CloudinaryUploadResponse;
  } catch {
    throw new Error('Cloudinary upload failed: invalid JSON response.');
  }

  const mapped = mapUploadResponse(json);
  if (!mapped.secureUrl || !mapped.publicId) {
    throw new Error('Cloudinary upload failed: missing secure URL or public ID.');
  }

  return mapped;
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  const trimmed = String(publicId || '').trim();
  if (!trimmed) return;

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams({ public_id: trimmed, timestamp }, apiSecret);

  const form = new FormData();
  form.append('public_id', trimmed);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary delete failed (${response.status}): ${text}`);
  }
}
