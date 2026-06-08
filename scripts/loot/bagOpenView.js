import {
    LOOT_ANIM_FRAME_COUNT,
    prepareLootAnim,
    buildLootAnimFrame,
    lootFontSizeForRows,
    drawLootGridOnCanvas,
} from './lootArt.js';

const AUTO_ADVANCE_MS = 2500;

/**
 * @param {object} lootState
 * @param {number} tick
 */
export function buildLootOpenGrid(lootState, tick) {
    const animId = lootState.animId ?? 'abandoned_bag';
    const prepared = prepareLootAnim(animId);
    const frameIndex = lootState.animFrame % LOOT_ANIM_FRAME_COUNT;
    return buildLootAnimFrame(prepared.baseGrid, prepared.layout, frameIndex, {
        noShimmer: prepared.noShimmer,
    });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} lootState
 * @param {number} tick
 */
export function renderBagOpen(canvas, lootState, tick) {
    const grid = buildLootOpenGrid(lootState, tick);
    drawLootGridOnCanvas(canvas, grid, {
        fontSize: lootFontSizeForRows(grid.length),
        background: '#0d0d0d',
        foreground: '#c8c8b8',
    });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {() => object | null} getLootState
 * @param {() => void} onDone
 * @returns {() => void} cancel/stop loop
 */
export function startBagAnimLoop(canvas, getLootState, onDone) {
    let rafId = 0;
    let lastTs = 0;
    let tick = 0;
    const startMs = performance.now();
    let done = false;

    function finish(invokeCallback = true) {
        if (done) return;
        done = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (invokeCallback) onDone();
    }

    function frame(ts) {
        if (done) return;
        const loot = getLootState();
        if (!loot) {
            finish();
            return;
        }

        if (ts - lastTs > 120) {
            tick += 1;
            loot.animTick = tick;
            loot.animFrame = (loot.animFrame + 1) % LOOT_ANIM_FRAME_COUNT;
            lastTs = ts;
        }

        renderBagOpen(canvas, loot, tick);

        if (performance.now() - startMs >= AUTO_ADVANCE_MS) {
            finish();
            return;
        }

        rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => finish(false);
}

