export const GHANA_CARD_FIELD_KEYS = [
  'ghanaCardId',
  'ghanaCardPersonalNumber',
  'ghanaCardDocumentNumber',
  'ghanaCardPlaceOfIssuance',
  'ghanaCardDateOfIssuance',
  'ghanaCardDateOfExpiry',
] as const;

export type GhanaCardFieldKey = (typeof GHANA_CARD_FIELD_KEYS)[number];

/** For Prisma create after Zod validated all Ghana Card fields as present. */
export function ghanaCardDataForCreateRequired(
  data: Partial<Record<GhanaCardFieldKey, string | null | undefined>>
): Record<GhanaCardFieldKey, string> {
  const out = {} as Record<GhanaCardFieldKey, string>;
  for (const k of GHANA_CARD_FIELD_KEYS) {
    const v = data[k];
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`Missing Ghana Card field: ${k}`);
    }
    out[k] = v.trim();
  }
  return out;
}

/** PATCH: undefined = omit; null or blank = clear in DB. */
export function ghanaCardPatchValue(
  v: string | null | undefined
): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}
