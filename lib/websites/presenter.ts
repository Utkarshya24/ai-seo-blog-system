import type { Website } from '@prisma/client';

export type WebsiteSafe = Omit<Website, 'gscRefreshTokenEnc'> & {
  gscConnected: boolean;
};

export function toWebsiteSafe(website: Website): WebsiteSafe {
  const { gscRefreshTokenEnc, ...rest } = website;
  void gscRefreshTokenEnc;
  return {
    ...rest,
    gscConnected: Boolean(website.gscRefreshTokenEnc),
  };
}
