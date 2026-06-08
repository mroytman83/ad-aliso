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
    reed_stealth: 'You crouch among the reeds. The battlefield noise fades to a dull roar.',
    mud_weapon: 'Something metal gleams in the mud — a blade, half swallowed by the mire.',
    scout_tracks: 'Fresh scout tracks. Someone is still hunting survivors.',
    wildlife_stir: 'A boar crashes through undergrowth. Your hand finds empty air where a sword should be.',
    corduroy_path: 'Log road underfoot — Roman engineering, sinking slowly into the swamp.',
    lippe_mist: 'Morning mist clings to the Lippe valley. You march southwest by habit.',
    scorched_village: 'Charred timbers and empty hearths. Nothing left to loot or burn.',
    hanged_trees: 'Bodies hang from roadside trees — a warning carved in flesh and rope.',
    ash_wind: 'Ash drifts on the wind. Each breath tastes of what Rome did to this land.',
    tiberius_road: 'A cut military road runs straight through ruin. Rome made this desert on purpose.',
    final_pursuit: 'Shouts behind you. They are closing on the fort.',
    north_fork: 'The trail climbs north into gray fog. Aliso lies the other way.',
    peat_fog: 'Gray fog hangs over black peat. Solid ground is a memory.',
    bructeri_patrol: 'A dugout slides along the riverbank. You flatten yourself into the moss.',
    dead_trees: 'Dead trees stand like spears in the bog. No birds sing here.',
    canoe_splash: 'Paddle strokes on the Ems. Fast, deliberate, searching.',
    river_mist: 'River mist hides the far bank. Anything could be watching.',
    exposed_bank: 'The bank offers no cover. You move before they round the bend.',
    turlough_sink: 'The turlough swallows your foot. You pull free by sheer stubbornness.',
    ampsivarii_parley: 'A warrior watches from a terp. His spear is lowered — for now.',
    boiocalus_chains: 'They speak of Boiocalus in chains. The tribe is split down the middle.',
    terp_refuge: 'A raised mound — dry ground at last. Eyes watch from the palisade.',
    chatti_line: 'Timber barriers block the ravine. Discipline, not chaos — the Chatti fight as one.',
    ravine_echo: 'Your footsteps echo off slate walls. There is no easy way out.',
    timber_barrier: 'Fallen timber seals the path behind you. They planned this.',
    suebi_horn: 'A horn blasts from the ridge — Suebi mercenaries, knot-haired and hungry.',
    vulture_imp_ambush:
        'Shapes lurch from the mud — bird-skull masks, stolen plate clutched to sunken chests.',
    anglii_framea_boat_ambush:
        'A dugout cuts through the mist — Anglii frameati, paddles biting the current.',
};

const AMBUSH_TEXT = {
    vulture_imp: 'vulture_imp_ambush',
    anglii_framea_boat: 'anglii_framea_boat_ambush',
};

/** Ally encounter chance by region id. */
const ALLY_ENCOUNTER_ODDS = {
    marshes_edge: 0.35,
};

/** Battle chance when entering a new region (tune per terrain later). */
const ENCOUNTER_CHANCE = {
    default: 0.12,
    forest: 0.25,
    marsh: 0.25,
    reeds: 0.28,
    road: 0.1,
    peat_bog: 0.2,
    river: 0.22,
    scorched: 0.18,
};

/**
 * @param {{ terrain?: string }} region
 * @param {() => number} rng
 */
export function rollEncounter(region, rng) {
    const terrain = region?.terrain ?? 'default';
    const chance = ENCOUNTER_CHANCE[terrain] ?? ENCOUNTER_CHANCE.default;
    if (rng() >= chance) return null;

    if (terrain === 'river') {
        return { type: 'battle', enemyId: 'anglii_framea_boat' };
    }

    return { type: 'battle', enemyId: 'vulture_imp' };
}

/**
 * @param {string} regionId
 * @param {{ terrain?: string, placeId?: string | null }} region
 * @param {() => number} rng
 */
export function rollAllyEncounter(regionId, region, rng) {
    const isMarshesEdge = regionId === 'marshes_edge' || region?.placeId === 'marshes_edge';
    if (!isMarshesEdge) return null;
    const odds = ALLY_ENCOUNTER_ODDS.marshes_edge;
    if (rng() >= odds) return null;
    return {
        type: 'ally',
        allyTemplateId: 'straggler_legionary',
        encounterId: 'legionary_straggler_found',
        text: 'A battered legionary stumbles from the reeds, shield splintered but eyes clear.',
    };
}

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
    const point =
        atPoint ??
        randomPointInRegion(region.bbox, worldMap.regionIndex, region.seedIndex, rnd);

    const encounter = rollEncounter(region, rnd);
    if (encounter?.type === 'battle') {
        const ambushId = AMBUSH_TEXT[encounter.enemyId] ?? 'vulture_imp_ambush';
        return {
            ...gameState,
            lastRegionId: regionId,
            lastPlaceId: region.placeId ?? gameState.lastPlaceId,
            enterCount: (gameState.enterCount ?? 0) + 1,
            lastEvent: {
                id: ambushId,
                text: EVENT_TEXT[ambushId] ?? EVENT_TEXT.vulture_imp_ambush,
            },
            lastEventPoint: point,
            pendingBattle: encounter.enemyId,
            pendingAllyEncounter: null,
        };
    }

    const allyEncounter = rollAllyEncounter(regionId, region, rnd);
    if (allyEncounter?.type === 'ally') {
        return {
            ...gameState,
            lastRegionId: regionId,
            lastPlaceId: region.placeId ?? gameState.lastPlaceId,
            enterCount: (gameState.enterCount ?? 0) + 1,
            lastEvent: {
                id: allyEncounter.encounterId,
                text: allyEncounter.text,
            },
            lastEventPoint: point,
            pendingBattle: null,
            pendingAllyEncounter: {
                templateId: allyEncounter.allyTemplateId,
                encounterId: allyEncounter.encounterId,
            },
        };
    }

    const event = rollRegionEvent(region, rnd);

    return {
        ...gameState,
        lastRegionId: regionId,
        lastPlaceId: region.placeId ?? gameState.lastPlaceId,
        enterCount: (gameState.enterCount ?? 0) + 1,
        lastEvent: event,
        lastEventPoint: point,
        pendingBattle: null,
        pendingAllyEncounter: null,
    };
}

/** @deprecated alias — use onEnterRegion */
export function onEnterPlace(gameState, placeId, worldMap) {
    const region = worldMap.getRegionForPlace(placeId);
    if (!region) return gameState;
    return onEnterRegion(gameState, region.id, worldMap);
}
