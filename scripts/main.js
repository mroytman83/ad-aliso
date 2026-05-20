import World from './world.js';
import { computeGridMeta, buildWorldAsciiGrid, renderWorldMap } from './asciiMap.js';
import { buildWorldMap } from './regions/worldMap.js';
import { keyToDelta, moveGrid, spawnAtPlace } from './movement/gridMove.js';
import { onEnterRegion } from './events.js';

const WORLD_SEED = 42;

let gridMeta = computeGridMeta(World);
let worldMap = buildWorldMap(World, gridMeta, { worldSeed: WORLD_SEED, extraSeedCount: 3 });
/** @type {boolean[][]} */
let walkable = [];
/** @type {Record<string, { gx: number, gy: number, sprite: string[] }>} */
let mapAnchors = {};

let gameState = {
    player: {
        locationId: 'teutoburg_fringe',
        regionId: 'teutoburg_fringe',
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
    if (!canvas) return;
    renderWorldMap(canvas, World, {
        worldMap,
        decorSeedSalt: String(gameState.worldSeed),
        playerPos: { gx: gameState.player.gridX, gy: gameState.player.gridY },
    });
    updateStatus();
}

function onKeyDown(e) {
    const delta = keyToDelta(e.key);
    if (!delta) return;
    e.preventDefault();

    const [dx, dy] = delta;
    const prevRegionId = gameState.player.regionId;
    const next = moveGrid(gameState, worldMap, walkable, dx, dy);
    if (!next) return;

    gameState = next;
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

    const first = buildWorldAsciiGrid(World, { worldMap, decorSeedSalt: String(WORLD_SEED) });
    walkable = first.walkable;
    mapAnchors = first.anchors;

    const spawn = spawnAtPlace(mapAnchors, gameState.player.locationId, worldMap, walkable);
    gameState.player.gridX = spawn.gx;
    gameState.player.gridY = spawn.gy;
    gameState.player.regionId = worldMap.regionIdAt(spawn.gx, spawn.gy) ?? gameState.player.locationId;

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
