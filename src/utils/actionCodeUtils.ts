/**
 * Utilities for parsing and rendering structured action codes (e.g. "2.6.4", "2, 6, 4", "2-4-6")
 * with cross-out (dicoret) tracking for completed vs remaining (kurang tindakan) procedures.
 */

/**
 * Splits an actionCode string into individual action tokens.
 * Handles delimiters like '.', ',', '/', '-', '+', and spaces.
 */
export function parseActionTokens(actionCode?: string): string[] {
  if (!actionCode || typeof actionCode !== 'string') return [];
  const trimmed = actionCode.trim();
  if (!trimmed) return [];

  // Check if string contains standard dot/dash/comma/slash separators
  // Example: "2.6.4" -> ["2", "6", "4"]
  // Example: "2, 6, 4" -> ["2", "6", "4"]
  // Example: "2-4-6" -> ["2", "4", "6"]
  // Example: "2 / 6 / 4" -> ["2", "6", "4"]
  // Example: "MWD + TENS" -> ["MWD", "TENS"]
  const tokens = trimmed
    .split(/[.,/\-+\s]+/)
    .map(t => t.trim())
    .filter(Boolean);

  // If no delimiter split happened, return single trimmed token
  return tokens.length > 0 ? tokens : [trimmed];
}

/**
 * Returns available tokens from actionCode, or standard fallback numbers [2, 4, 6] if none specified
 */
export function getActionTokensOrFallback(actionCode?: string): string[] {
  const parsed = parseActionTokens(actionCode);
  if (parsed.length > 0) return parsed;
  return ['2', '4', '6'];
}

/**
 * Returns tokens that are still remaining (not crossed out / belum selesai)
 */
export function getRemainingActionTokens(allTokens: string[], crossedTokens: string[] = []): string[] {
  const crossedSet = new Set(crossedTokens.map(c => c.trim().toUpperCase()));
  return allTokens.filter(t => !crossedSet.has(t.trim().toUpperCase()));
}

/**
 * Toggles a token inside the crossed-out list
 */
export function toggleCrossedToken(currentCrossed: string[] = [], tokenToToggle: string): string[] {
  const upper = tokenToToggle.trim().toUpperCase();
  const exists = currentCrossed.some(c => c.trim().toUpperCase() === upper);
  if (exists) {
    return currentCrossed.filter(c => c.trim().toUpperCase() !== upper);
  } else {
    return [...currentCrossed, tokenToToggle.trim()];
  }
}

/**
 * Formats a remaining description, e.g. "2.6" or "2"
 */
export function formatRemainingCodes(allTokens: string[], crossedTokens: string[] = []): string {
  const remaining = getRemainingActionTokens(allTokens, crossedTokens);
  if (remaining.length === 0) return 'Semua Selesai';
  return remaining.join('.');
}

/**
 * Formats crossed description, e.g. "4" or "4.6"
 */
export function formatCrossedCodes(allTokens: string[], crossedTokens: string[] = []): string {
  const crossedSet = new Set(crossedTokens.map(c => c.trim().toUpperCase()));
  const crossed = allTokens.filter(t => crossedSet.has(t.trim().toUpperCase()));
  if (crossed.length === 0) return 'Belum ada dicoret';
  return crossed.join('.');
}

/**
 * Generate smart preset options for a patient's action code tokens
 * Example: for ["2", "6", "4"]:
 * - Kurang 2.6 (Coret 4)
 * - Kurang 2 (Coret 6, 4)
 * - Kurang 4 (Coret 2, 6)
 */
export interface ActionPreset {
  label: string;
  shortLabel: string;
  crossedTokens: string[];
  remainingTokens: string[];
}

export function generateActionPresets(allTokens: string[]): ActionPreset[] {
  if (allTokens.length <= 1) return [];

  const presets: ActionPreset[] = [];

  // Preset 1: If 3 tokens (e.g. 2, 6, 4)
  if (allTokens.length === 3) {
    // Kurang 2.6 (Coret 4)
    presets.push({
      label: `Kurang ${allTokens[0]}.${allTokens[1]} (Coret ${allTokens[2]})`,
      shortLabel: `Kurang ${allTokens[0]}.${allTokens[1]}`,
      crossedTokens: [allTokens[2]],
      remainingTokens: [allTokens[0], allTokens[1]],
    });
    // Kurang 2 (Coret 6, 4)
    presets.push({
      label: `Kurang ${allTokens[0]} (Coret ${allTokens[1]}.${allTokens[2]})`,
      shortLabel: `Kurang ${allTokens[0]}`,
      crossedTokens: [allTokens[1], allTokens[2]],
      remainingTokens: [allTokens[0]],
    });
  } else if (allTokens.length === 2) {
    // Kurang first (Coret second)
    presets.push({
      label: `Kurang ${allTokens[0]} (Coret ${allTokens[1]})`,
      shortLabel: `Kurang ${allTokens[0]}`,
      crossedTokens: [allTokens[1]],
      remainingTokens: [allTokens[0]],
    });
  } else if (allTokens.length > 3) {
    // For 4+ tokens, provide common subsets
    const half = Math.ceil(allTokens.length / 2);
    const rem1 = allTokens.slice(0, half);
    const crs1 = allTokens.slice(half);
    presets.push({
      label: `Kurang ${rem1.join('.')} (Coret ${crs1.join('.')})`,
      shortLabel: `Kurang ${rem1.join('.')}`,
      crossedTokens: crs1,
      remainingTokens: rem1,
    });
  }

  return presets;
}

/**
 * Appends a new action code to an existing actionCode string.
 * Allows the same code to be clicked multiple times without restriction!
 * (e.g. clicking '2' then '2' becomes '2.2', or '2' then '6' then '4' then '2' becomes '2.6.4.2')
 */
export function appendActionCode(currentCode: string | undefined, codeToAdd: string): string {
  const trimmed = (currentCode || '').trim();
  const trimmedAdd = codeToAdd.trim();
  if (!trimmed) return trimmedAdd;
  if (!trimmedAdd) return trimmed;

  if (trimmed.includes(',')) {
    return `${trimmed}, ${trimmedAdd}`;
  }
  if (trimmed.includes('+')) {
    return `${trimmed} + ${trimmedAdd}`;
  }
  if (trimmed.includes('-')) {
    return `${trimmed}-${trimmedAdd}`;
  }
  if (trimmed.includes('/')) {
    return `${trimmed}/${trimmedAdd}`;
  }
  // Default clean medical dot delimiter (e.g. 2.6.4, 2.2)
  return `${trimmed}.${trimmedAdd}`;
}
