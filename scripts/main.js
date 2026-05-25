import World from './world.js';
import { computeGridMeta, buildWorldAsciiGrid, renderViewport } from './asciiMap.js';
import { buildWorldMap } from './regions/worldMap.js';
import { keyToDelta, moveGrid, spawnAtPlace } from './movement/gridMove.js';
import { onEnterRegion } from './events.js';
import {
    VIEWPORT_COLS,
    VIEWPORT_ROWS,
    computeCameraOrigin,
} from './viewport.js';

const WORLD_SEED = 42;
const MAP_OPTS = { cellW: 30, cellH: 16, margin: 4 };

let gridMeta = computeGridMeta(World, MAP_OPTS);
let worldMap = buildWorldMap(World, gridMeta, { worldSeed: WORLD_SEED, extraSeedCount: 14 });
/** @type {boolean[][]} */
let walkable = [];
/** @type {Record<string, { gx: number, gy: number, sprite: string[] }>} */
let mapAnchors = {};
/** @type {string[][]} */
let baseGrid = [];
/** @type {string[][]} */
let fullGrid = [];

let gameState = {
    player: {
        locationId: 'marshes_edge',
        regionId: 'marshes_edge',
        gridX: 0,
        gridY: 0,
    },
    worldSeed: WORLD_SEED,
    lastRegionId: null,
    lastPlaceId: null,
    lastEvent: null,
    lastEventPoint: null,
    enterCount: 0,
};

function cloneGrid(grid) {
    return grid.map((row) => [...row]);
}

function stampPlayer(gx, gy) {
    if (fullGrid[gy] && gx >= 0 && gx < fullGrid[gy].length) {
        fullGrid[gy][gx] = '@';
    }
}

function clearPlayer(gx, gy) {
    if (baseGrid[gy] && gx >= 0 && gx < baseGrid[gy].length) {
        fullGrid[gy][gx] = baseGrid[gy][gx];
    }
}

function updateStatus() {
    const statusEl = document.getElementById('location-status');
    const eventEl = document.getElementById('event-log');
    const place = World.getPlace(gameState.player.locationId);
    const title = place?.title ?? gameState.player.locationId;
    const region = worldMap.regions[gameState.player.regionId];
    const regionLabel = region?.placeId ? title : (region?.id ?? 'wilds');

    if (statusEl) {
        const terrain = region?.terrain ?? '';
        statusEl.textContent = `${regionLabel} (${terrain}) at [${gameState.player.gridX},${gameState.player.gridY}] — walk with arrows/WASD`;
    }

    if (eventEl) {
        if (gameState.lastEvent) {
            const pt = gameState.lastEventPoint;
            const at = pt ? ` [${pt.gx},${pt.gy}]` : '';
            eventEl.textContent = `${gameState.lastEvent.text}${at}`;
        } else {
            eventEl.textContent = '';
        }
    }
}

function render() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas || !fullGrid.length) return;

    const { ox, oy } = computeCameraOrigin(
        gameState.player.gridX,
        gameState.player.gridY,
        worldMap.cols,
        worldMap.rows,
        VIEWPORT_COLS,
        VIEWPORT_ROWS,
    );

    renderViewport(canvas, fullGrid, { ox, oy });
    updateStatus();
}

function onKeyDown(e) {
    const delta = keyToDelta(e.key);
    if (!delta) return;
    e.preventDefault();

    const [dx, dy] = delta;
    const prevGx = gameState.player.gridX;
    const prevGy = gameState.player.gridY;
    const prevRegionId = gameState.player.regionId;
    const next = moveGrid(gameState, worldMap, walkable, dx, dy);
    if (!next) return;

    clearPlayer(prevGx, prevGy);
    gameState = next;
    stampPlayer(gameState.player.gridX, gameState.player.gridY);

    if (gameState.player.regionId !== prevRegionId) {
        gameState = onEnterRegion(gameState, gameState.player.regionId, worldMap, {
            gx: gameState.player.gridX,
            gy: gameState.player.gridY,
        });
    }
    render();
}

function init() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) {
        console.error('Ad Aliso: #map-canvas not found');
        return;
    }

    const built = buildWorldAsciiGrid(World, {
        worldMap,
        decorSeedSalt: String(WORLD_SEED),
        ...MAP_OPTS,
    });
    walkable = built.walkable;
    mapAnchors = built.anchors;
    baseGrid = cloneGrid(built.grid);
    fullGrid = cloneGrid(built.grid);

    const spawn = spawnAtPlace(mapAnchors, gameState.player.locationId, worldMap, walkable);
    gameState.player.gridX = spawn.gx;
    gameState.player.gridY = spawn.gy;
    gameState.player.regionId = worldMap.regionIdAt(spawn.gx, spawn.gy) ?? gameState.player.locationId;

    stampPlayer(spawn.gx, spawn.gy);
    gameState = onEnterRegion(gameState, gameState.player.regionId, worldMap, spawn);
    canvas.tabIndex = 0;
    render();

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('click', () => canvas.focus());
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
