import { stableHash32, mulberry32 } from '../util/random.js';
import { resolveItemStack } from './items.js';
import { pickLootAnimId } from './lootAnimations.js';

/** Terrains where loot bags must not appear. */
export const LOOT_SPAWN_EXCLUDED_TERRAINS = ['river'];

/** @type {Record<string, { id: string, mapChar: string, label: string, contents: { id: string, qty: number }[] }>} */
export const LOOTABLES = {
    abandoned_bag: {
        id: 'abandoned_bag',
        mapChar: '$',
        label: 'Abandoned Bag',
        contents: [
            { id: 'wax_tablet', qty: 1 },
            { id: 'lorica_segment', qty: 1 },
        ],
    },
};

/**
 * @param {string} lootableId
 * @returns {{ id: string, name: string, qty: number }[]}
 */
export function resolveLootContents(lootableId) {
    const template = LOOTABLES[lootableId];
    if (!template) return [];
    return template.contents
        .map((entry) => resolveItemStack(entry))
        .filter(Boolean);
}

/**
 * @param {import('../regions/worldMap.js').buildWorldMap extends Function ? ReturnType<import('../regions/worldMap.js').buildWorldMap> : object} worldMap
 * @param {boolean[][]} walkable
 * @param {{ bbox: { minGx: number, minGy: number, maxGx: number, maxGy: number }, seedIndex: number }} region
 */
export function collectWalkableTilesInRegion(worldMap, walkable, region) {
    const bbox = region.bbox;
    if (!bbox) return [];

    const candidates = [];
    for (let gy = bbox.minGy; gy <= bbox.maxGy; gy++) {
        for (let gx = bbox.minGx; gx <= bbox.maxGx; gx++) {
            if (worldMap.regionIndex[gy]?.[gx] !== region.seedIndex) continue;
            if (!walkable[gy]?.[gx]) continue;
            candidates.push({ gx, gy });
        }
    }
    return candidates;
}

/**
 * Bags per region from walkable area (modest bump over 1-per-region).
 * @param {number} walkableCount
 */
export function bagsPerRegion(walkableCount) {
    if (walkableCount < 35) return 1;
    if (walkableCount < 90) return 2;
    return 3;
}

/**
 * @param {{ gx: number, gy: number }[]} candidates
 * @param {number} count
 * @param {() => number} rnd
 */
function pickDistinctTiles(candidates, count, rnd) {
    const pool = [...candidates];
    const picks = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(rnd() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
}

/**
 * Abandoned bags in each non-river region (1–3 per region by size).
 * @param {import('../regions/worldMap.js').buildWorldMap extends Function ? ReturnType<import('../regions/worldMap.js').buildWorldMap> : object} worldMap
 * @param {boolean[][]} walkable
 * @param {number} worldSeed
 * @param {{ gx: number, gy: number } | null} [avoid] — skip this tile (e.g. player spawn)
 * @returns {{ instanceId: string, lootableId: string, animId: string, gx: number, gy: number, regionId: string, opened: boolean, introSeen: boolean, remainingItems?: { id: string, name: string, qty: number }[] }[]}
 */
export function spawnLootables(worldMap, walkable, worldSeed, avoid = null) {
    const lootables = [];
    const usedTiles = new Set();

    for (const region of Object.values(worldMap.regions)) {
        if (LOOT_SPAWN_EXCLUDED_TERRAINS.includes(region.terrain)) continue;

        let candidates = collectWalkableTilesInRegion(worldMap, walkable, region);
        if (avoid) {
            candidates = candidates.filter((c) => c.gx !== avoid.gx || c.gy !== avoid.gy);
        }
        candidates = candidates.filter((c) => !usedTiles.has(`${c.gx},${c.gy}`));
        if (!candidates.length) continue;

        const count = Math.min(bagsPerRegion(candidates.length), candidates.length);
        const rnd = mulberry32(stableHash32(`${worldSeed}|loot|bag|${region.id}`));
        const picks = pickDistinctTiles(candidates, count, rnd);

        picks.forEach((pick, index) => {
            usedTiles.add(`${pick.gx},${pick.gy}`);
            const suffix = picks.length > 1 ? `_${index}` : '';
            const instanceId = `bag_${region.id}${suffix}`;
            lootables.push({
                instanceId,
                lootableId: 'abandoned_bag',
                animId: pickLootAnimId(worldSeed, instanceId),
                gx: pick.gx,
                gy: pick.gy,
                regionId: region.id,
                opened: false,
                introSeen: false,
            });
        });
    }

    return lootables;
}

/**
 * @param {string[][]} fullGrid
 * @param {string[][]} baseGrid
 * @param {{ instanceId: string, lootableId: string, gx: number, gy: number, opened: boolean }[]} lootables
 */
export function stampLootables(fullGrid, baseGrid, lootables) {
    for (const inst of lootables) {
        if (inst.opened) continue;
        const template = LOOTABLES[inst.lootableId];
        if (!template) continue;
        const ch = template.mapChar;
        for (const grid of [fullGrid, baseGrid]) {
            if (grid[inst.gy] && inst.gx >= 0 && inst.gx < grid[inst.gy].length) {
                grid[inst.gy][inst.gx] = ch;
            }
        }
    }
}

/**
 * @param {string[][]} fullGrid
 * @param {string[][]} baseGrid
 * @param {{ gx: number, gy: number }} inst
 */
export function clearLootableTile(fullGrid, baseGrid, inst) {
    if (baseGrid[inst.gy] && inst.gx >= 0 && inst.gx < baseGrid[inst.gy].length) {
        fullGrid[inst.gy][inst.gx] = baseGrid[inst.gy][inst.gx];
    }
}
