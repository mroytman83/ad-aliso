/** @type {Record<string, { id: string, name: string }>} */
export const ITEMS = {
    wax_tablet: { id: 'wax_tablet', name: 'Ruined Wax Tablet' },
    lorica_segment: { id: 'lorica_segment', name: 'Stolen Lorica Segment' },
    tribal_totem: { id: 'tribal_totem', name: 'Carved Tribal Totem' },
};

/**
 * @param {string} id
 * @returns {{ id: string, name: string } | null}
 */
export function getItem(id) {
    return ITEMS[id] ?? null;
}

/**
 * @param {{ id: string, qty?: number }} entry
 * @returns {{ id: string, name: string, qty: number } | null}
 */
export function resolveItemStack(entry) {
    const def = getItem(entry.id);
    if (!def) return null;
    return { id: def.id, name: def.name, qty: entry.qty ?? 1 };
}
