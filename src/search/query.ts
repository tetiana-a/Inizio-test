export const MAX_QUERY_LENGTH = 200;

export type QueryCheck = { ok: true; query: string } | { ok: false; error: string };

/** Ořízne mezery, sloučí vícenásobné mezery a zkontroluje délku. */
export function parseQuery(input: unknown): QueryCheck {
  if (typeof input !== "string") return { ok: false, error: "Zadejte klíčové slovo." };
  const query = input.replace(/\s+/g, " ").trim();
  if (!query) return { ok: false, error: "Zadejte klíčové slovo." };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `Klíčové slovo může mít nejvýše ${MAX_QUERY_LENGTH} znaků.` };
  }
  return { ok: true, query };
}
