export const DISCORD_INVITE_REGEX =
  /^https:\/\/(discord\.gg\/|discord\.com\/invite\/)[A-Za-z0-9-]+\/?$/i;

export function validateDiscordInvite(url: string): { valid: boolean; error?: string } {
  const trimmed = (url || '').trim();
  if (!trimmed) return { valid: true };
  if (trimmed.length > 200) return { valid: false, error: 'Discord invite URL too long (max 200 chars).' };
  if (!DISCORD_INVITE_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Must be a discord.gg/... or discord.com/invite/... link.',
    };
  }
  return { valid: true };
}

export function normalizeDiscordInvite(url?: string | null): string | null {
  const t = (url || '').trim();
  return t ? t : null;
}

export function resolveDiscordInvite(
  productInvite?: string | null,
  sellerDefaultInvite?: string | null,
): string | null {
  return normalizeDiscordInvite(productInvite) || normalizeDiscordInvite(sellerDefaultInvite);
}