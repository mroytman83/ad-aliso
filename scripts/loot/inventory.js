/**
 * @param {{ id: string, name: string, qty: number }[]} inventory
 * @param {{ id: string, name: string, qty?: number }} item
 */
export function addToInventory(inventory, item) {
    const qty = item.qty ?? 1;
    const existing = inventory.find((s) => s.id === item.id);
    if (existing) {
        existing.qty += qty;
    } else {
        inventory.push({ id: item.id, name: item.name, qty });
    }
    return inventory;
}

/**
 * @param {{ id: string, name: string, qty: number }[]} inventory
 * @param {{ id: string, name: string, qty: number }[]} items
 */
export function addAllToInventory(inventory, items) {
    for (const item of items) {
        addToInventory(inventory, item);
    }
    return inventory;
}

/**
 * @param {{ id: string, name: string, qty: number }[]} inventory
 */
export function inventoryCount(inventory) {
    return inventory.reduce((sum, s) => sum + s.qty, 0);
}
