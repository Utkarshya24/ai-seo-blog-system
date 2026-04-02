import { NextRequest } from 'next/server';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const MAX_LIMIT = 20;

export function getPaginationParams(request: NextRequest): PaginationParams {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const requestedLimit = Number(searchParams.get('limit') || String(MAX_LIMIT));
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function getPaginationMeta(params: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const { page, limit, total } = params;
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
