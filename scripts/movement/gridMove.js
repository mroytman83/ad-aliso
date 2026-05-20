import { spriteSize } from '../asciiMap.js';
import { keyToDirection } from './move.js';

export const DIRECTION_DELTA = {
    north: [0, -1],
    south: [0, 1],
    east: [1, 0],
    west: [-1, 0],
};

/**
 * @param {string} key
 * @returns {[number, number] | null}
 */
export function keyToDelta(key) {
    const dir = keyToDirection(key);
    if (!dir) return null;
    return DIRECTION_DELTA[dir];
}

/**
 * @param {object} state
 * @param {import('../regions/worldMap.js').buildWorldMap extends Function ? ReturnType<import('../regions/worldMap.js').buildWorldMap> : object} worldMap
 * @param {boolean[][]} walkable
 * @param {number} dx
 * @param {number} dy
 */
export function moveGrid(state, worldMap, walkable, dx, dy) {
    const gx = state.player.gridX + dx;
    const gy = state.player.gridY + dy;
    const cols = worldMap.cols;
    const rows = worldMap.rows;

    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return null;
    if (!walkable[gy]?.[gx]) return null;

    const regionId = worldMap.regionIdAt(gx, gy);
    if (!regionId) return null;

    const region = worldMap.regions[regionId];
    let locationId = state.player.locationId;
    if (region?.placeId) locationId = region.placeId;

    return {
        ...state,
        player: {
            ...state.player,
            gridX: gx,
            gridY: gy,
            regionId,
            locationId,
        },
    };
}

/**
 * @param {Record<string, { gx: number, gy: number, sprite: string[] }>} anchors
 * @param {string} placeId
 * @param {ReturnType<import('../regions/worldMap.js').buildWorldMap>} worldMap
 * @param {boolean[][]} walkable
 */
export function spawnAtPlace(anchors, placeId, worldMap, walkable) {
    const region = worldMap.getRegionForPlace(placeId);
    const anchor = anchors[placeId];
    const queue = [];
    const seen = new Set();

    if (anchor && region) {
        const { w, h } = spriteSize(anchor.sprite);
        const mx = anchor.gx + Math.floor(w / 2);
        const my = anchor.gy + h;
        queue.push({ gx: mx, gy: my });
        queue.push({ gx: mx, gy: my + 1 });
        queue.push({ gx: mx, gy: anchor.gy + h - 1 });
    }

    if (region?.bbox) {
        const cx = Math.floor((region.bbox.minGx + region.bbox.maxGx) / 2);
        const cy = Math.floor((region.bbox.minGy + region.bbox.maxGy) / 2);
        queue.push({ gx: cx, gy: cy });
    }

    while (queue.length) {
        const { gx, gy } = queue.shift();
        const key = `${gx},${gy}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (gx < 0 || gy < 0 || gx >= worldMap.cols || gy >= worldMap.rows) continue;
        if (region && worldMap.regionIndex[gy][gx] !== region.seedIndex) continue;
        if (walkable[gy][gx]) return { gx, gy };

        queue.push({ gx: gx + 1, gy }, { gx: gx - 1, gy }, { gx, gy: gy + 1 }, { gx, gy: gy - 1 });
    }

    for (let gy = 0; gy < worldMap.rows; gy++) {
        for (let gx = 0; gx < worldMap.cols; gx++) {
            if (walkable[gy][gx]) return { gx, gy };
        }
    }

    return { gx: Math.floor(worldMap.cols / 2), gy: Math.floor(worldMap.rows / 2) };
}
