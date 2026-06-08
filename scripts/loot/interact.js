import { LOOTABLES, resolveLootContents } from './lootables.js';
import { getLootAnimLabel } from './lootAnimations.js';

/**
 * @param {{ remainingItems?: { id: string, name: string, qty: number }[] }} instance
 * @param {string} lootableId
 */
export function getInstanceContents(instance, lootableId) {
    if (instance.remainingItems?.length) {
        return instance.remainingItems.map((i) => ({ ...i }));
    }
    return resolveLootContents(lootableId);
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} lx
 * @param {number} ly
 */
export function isAdjacentOrOn(px, py, lx, ly) {
    return Math.max(Math.abs(px - lx), Math.abs(py - ly)) <= 1;
}

/**
 * @param {{ gridX: number, gridY: number }} player
 * @param {{ instanceId: string, lootableId: string, gx: number, gy: number, opened: boolean }[]} lootables
 */
export function findNearbyLootable(player, lootables) {
    for (const inst of lootables) {
        if (inst.opened) continue;
        if (isAdjacentOrOn(player.gridX, player.gridY, inst.gx, inst.gy)) {
            return inst;
        }
    }
    return null;
}

/**
 * @param {object} gameState
 * @param {{ instanceId: string, lootableId: string, animId?: string, introSeen?: boolean, remainingItems?: { id: string, name: string, qty: number }[] }} instance
 * @param {'loot_open' | 'loot_contents'} [startMode]
 */
export function createLootSession(gameState, instance, startMode = 'loot_open') {
    const remainingItems = getInstanceContents(instance, instance.lootableId);
    const animId = instance.animId ?? 'abandoned_bag';

    return {
        ...gameState,
        mode: startMode,
        loot: {
            instanceId: instance.instanceId,
            templateId: instance.lootableId,
            animId,
            label: getLootAnimLabel(animId),
            phase: startMode === 'loot_contents' ? 'contents' : 'open',
            animFrame: 0,
            animTick: 0,
            menuIndex: 0,
            itemIndex: 0,
            selectMode: false,
            remainingItems: remainingItems.map((i) => ({ ...i })),
            openedAt: Date.now(),
        },
    };
}
