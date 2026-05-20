/**
 * Grid Voronoi: nearest-seed assignment + Lloyd relaxation.
 */

/**
 * @param {number} cols
 * @param {number} rows
 * @param {{ id: string, gx: number, gy: number }[]} seeds
 * @returns {number[][]} regionIndex[gy][gx] = seed index
 */
export function assignCellsToNearestSeed(cols, rows, seeds) {
    const index = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
            let best = 0;
            let bestD = Infinity;
            for (let s = 0; s < seeds.length; s++) {
                const dx = gx - seeds[s].gx;
                const dy = gy - seeds[s].gy;
                const d = dx * dx + dy * dy;
                if (d < bestD) {
                    bestD = d;
                    best = s;
                }
            }
            index[gy][gx] = best;
        }
    }
    return index;
}

/**
 * @param {number[][]} regionIndex
 * @param {{ id: string, gx: number, gy: number }[]} seeds
 * @param {number} iterations
 * @returns {{ regionIndex: number[][], seeds: typeof seeds }}
 */
export function lloydRelax(regionIndex, seeds, iterations = 4) {
    const cols = regionIndex[0]?.length ?? 0;
    const rows = regionIndex.length;
    let currentSeeds = seeds.map((s) => ({ ...s }));
    let currentIndex = regionIndex;

    for (let iter = 0; iter < iterations; iter++) {
        const sums = currentSeeds.map(() => ({ sx: 0, sy: 0, n: 0 }));
        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                const si = currentIndex[gy][gx];
                sums[si].sx += gx;
                sums[si].sy += gy;
                sums[si].n += 1;
            }
        }
        for (let s = 0; s < currentSeeds.length; s++) {
            if (sums[s].n > 0) {
                currentSeeds[s].gx = sums[s].sx / sums[s].n;
                currentSeeds[s].gy = sums[s].sy / sums[s].n;
            }
        }
        currentIndex = assignCellsToNearestSeed(cols, rows, currentSeeds);
    }

    return { regionIndex: currentIndex, seeds: currentSeeds };
}

/**
 * @param {number[][]} regionIndex
 * @param {number} seedIndex
 */
export function regionBBox(regionIndex, seedIndex) {
    const rows = regionIndex.length;
    const cols = regionIndex[0]?.length ?? 0;
    let minGx = cols;
    let minGy = rows;
    let maxGx = 0;
    let maxGy = 0;
    let found = false;

    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
            if (regionIndex[gy][gx] !== seedIndex) continue;
            found = true;
            minGx = Math.min(minGx, gx);
            minGy = Math.min(minGy, gy);
            maxGx = Math.max(maxGx, gx);
            maxGy = Math.max(maxGy, gy);
        }
    }

    if (!found) return null;
    return { minGx, minGy, maxGx, maxGy };
}

/**
 * @param {{ minGx: number, minGy: number, maxGx: number, maxGy: number }} bbox
 * @param {number[][]} regionIndex
 * @param {number} seedIndex
 * @param {() => number} rng
 * @param {number} maxAttempts
 */
export function randomPointInRegion(bbox, regionIndex, seedIndex, rng, maxAttempts = 64) {
    if (!bbox) return null;
    for (let i = 0; i < maxAttempts; i++) {
        const gx = bbox.minGx + Math.floor(rng() * (bbox.maxGx - bbox.minGx + 1));
        const gy = bbox.minGy + Math.floor(rng() * (bbox.maxGy - bbox.minGy + 1));
        if (regionIndex[gy]?.[gx] === seedIndex) return { gx, gy };
    }
    for (let gy = bbox.minGy; gy <= bbox.maxGy; gy++) {
        for (let gx = bbox.minGx; gx <= bbox.maxGx; gx++) {
            if (regionIndex[gy][gx] === seedIndex) return { gx, gy };
        }
    }
    return null;
}

/**
 * @param {number[][]} regionIndex
 * @param {number} cols
 * @param {number} rows
 */
export function borderMask(regionIndex, cols, rows) {
    const mask = Array.from({ length: rows }, () => Array(cols).fill(false));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
            const id = regionIndex[gy][gx];
            for (const [dx, dy] of dirs) {
                const nx = gx + dx;
                const ny = gy + dy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || regionIndex[ny][nx] !== id) {
                    mask[gy][gx] = true;
                    break;
                }
            }
        }
    }
    return mask;
}
