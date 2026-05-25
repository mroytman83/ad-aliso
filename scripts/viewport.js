export const VIEWPORT_COLS = 80;
export const VIEWPORT_ROWS = 24;

/**
 * @param {number} playerGx
 * @param {number} playerGy
 * @param {number} worldCols
 * @param {number} worldRows
 * @param {number} viewCols
 * @param {number} viewRows
 * @returns {{ ox: number, oy: number }}
 */
export function computeCameraOrigin(
    playerGx,
    playerGy,
    worldCols,
    worldRows,
    viewCols = VIEWPORT_COLS,
    viewRows = VIEWPORT_ROWS,
) {
    let ox = playerGx - Math.floor(viewCols / 2);
    let oy = playerGy - Math.floor(viewRows / 2);

    const maxOx = Math.max(0, worldCols - viewCols);
    const maxOy = Math.max(0, worldRows - viewRows);

    ox = Math.max(0, Math.min(ox, maxOx));
    oy = Math.max(0, Math.min(oy, maxOy));

    return { ox, oy };
}

/**
 * @param {string[][]} grid
 * @param {number} ox
 * @param {number} oy
 * @param {number} viewCols
 * @param {number} viewRows
 * @param {string} [fill=' ']
 * @returns {string[][]}
 */
export function extractViewport(grid, ox, oy, viewCols, viewRows, fill = ' ') {
    const worldRows = grid.length;
    const worldCols = worldRows ? grid[0].length : 0;
    const slice = [];

    for (let vy = 0; vy < viewRows; vy++) {
        const row = [];
        const gy = oy + vy;
        for (let vx = 0; vx < viewCols; vx++) {
            const gx = ox + vx;
            if (gy >= 0 && gy < worldRows && gx >= 0 && gx < worldCols) {
                row.push(grid[gy][gx]);
            } else {
                row.push(fill);
            }
        }
        slice.push(row);
    }

    return slice;
}
