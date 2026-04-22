function normalizeString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeWalletId(value: string | undefined | null): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function collectWalletSlotIds(prefix: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(.+?)_PRIVATE_KEY$`);
  const ids = new Set<string>();

  for (const key of Object.keys(process.env)) {
    const match = key.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    ids.add(match[1].toUpperCase());
  }

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

export function selectWalletById<T extends { walletId: string }>(
  wallets: T[],
  walletId?: string | null,
): T | null {
  if (walletId) {
    const normalizedWalletId = normalizeWalletId(walletId);
    return wallets.find((wallet) => normalizeWalletId(wallet.walletId) === normalizedWalletId) ?? null;
  }

  return wallets.length === 1 ? wallets[0] ?? null : null;
}
