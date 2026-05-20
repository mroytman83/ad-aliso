import { stableHash32, mulberry32 } from './util/random.js';
import { randomPointInRegion } from './regions/voronoi.js';

const EVENT_TEXT = {
    forest_silence: 'The forest holds its breath. Nothing moves but mist.',
    distant_horn: 'A horn sounds far away — friend or foe, you cannot tell.',
    broken_stone: 'Latin letters on a fallen stone, half buried in mud.',
    straggler: 'A legionary steps from the trees, hand on his gladius.',
    ford_ambush: 'Movement in the reeds. You do not wait to count them.',
    cold_crossing: 'The ford is waist-deep and bitter cold.',
    ridge_wind: 'Wind strips the ridge bare. You pull your cloak tighter.',
    tracker: 'Fresh tracks cross the path — many feet, hours old.',
    bog_mire: 'The ground sucks at your boots. Each step costs strength.',
    lost_dispatch: 'A wax tablet, ruined. The ink has run to nothing.',
    road_dust: 'Dust on a fragment of road — Rome once passed here.',
    deserter_rumor: 'Someone whispered that Aliso fell. You do not believe it yet.',
    gate_hope: 'Timber and earthworks. The gate still stands.',
    eagle_gone: 'No eagle on the wall. Your chest tightens anyway.',
    wolf_sign: 'Wolf scat on the trail. They are watching.',
    smoke_signal: 'Thin smoke to the north. A farm burning, or a signal fire.',
    empty_camp: 'Cold ashes. Whoever camped here left in haste.',
    raven_call: 'Ravens circle. They know something you do not.',
    bog_stench: 'Rot and standing water. The marsh claims the dead.',
    branch_snap: 'A branch snaps. The line between wind and footfall vanishes.',
};

/**
 * @param {{ eventPool?: string[], terrain?: string }} region
 * @param {() => number} rng
 */
export function rollRegionEvent(region, rng) {
    const pool = region?.eventPool;
    if (!pool?.length) return null;
    const id = pool[Math.floor(rng() * pool.length)];
    const text = EVENT_TEXT[id] ?? 'Something stirs in the wild.';
    return { id, text };
}

/**
 * @param {object} gameState
 * @param {string} regionId
 * @param {import('./regions/worldMap.js').buildWorldMap extends Function ? ReturnType<import('./regions/worldMap.js').buildWorldMap> : object} worldMap
 * @param {{ gx: number, gy: number } | null} [atPoint]
 */
export function onEnterRegion(gameState, regionId, worldMap, atPoint = null) {
    const region = worldMap.regions[regionId];
    if (!region) return gameState;

    if (gameState.lastRegionId === regionId) return gameState;

    const rnd = mulberry32(
        stableHash32(`${worldMap.worldSeed}|region|${regionId}|${gameState.enterCount ?? 0}`),
    );
    const event = rollRegionEvent(region, rnd);
    const point =
        atPoint ??
        randomPointInRegion(region.bbox, worldMap.regionIndex, region.seedIndex, rnd);

    const placeId = region.placeId ?? gameState.player.locationId;

    return {
        ...gameState,
        lastRegionId: regionId,
        lastPlaceId: region.placeId ?? gameState.lastPlaceId,
        enterCount: (gameState.enterCount ?? 0) + 1,
        lastEvent: event,
        lastEventPoint: point,
    };
}

/** @deprecated alias — use onEnterRegion */
export function onEnterPlace(gameState, placeId, worldMap) {
    const region = worldMap.getRegionForPlace(placeId);
    if (!region) return gameState;
    return onEnterRegion(gameState, region.id, worldMap);
}
