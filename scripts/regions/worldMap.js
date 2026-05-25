import { stableHash32, mulberry32 } from '../util/random.js';
import {
    assignCellsToNearestSeed,
    lloydRelax,
    regionBBox,
} from './voronoi.js';

const TERRAIN_TABLE = {
    forest: { groundChar: '.', propDensity: 0.08, propBeechBias: 0.5, propStyle: 'beech' },
    marsh: { groundChar: '~', propDensity: 0.03, propBeechBias: 0.2, propStyle: 'beech' },
    road: { groundChar: '=', propDensity: 0.02, propBeechBias: 0.3, propStyle: 'beech' },
    reeds: { groundChar: '|', propDensity: 0.01, propBeechBias: 0.1, propStyle: 'none' },
    river: { groundChar: '~', propDensity: 0, propBeechBias: 0, propStyle: 'none' },
    peat_bog: { groundChar: '#', propDensity: 0, propBeechBias: 0, propStyle: 'none' },
    terp: { groundChar: '^', propDensity: 0, propBeechBias: 0, propStyle: 'none' },
    scorched: { groundChar: '%', propDensity: 0, propBeechBias: 0, propStyle: 'none' },
    alpine: { groundChar: ':', propDensity: 0.04, propBeechBias: 0.15, propStyle: 'pine' },
    hillfort: { groundChar: 'O', propDensity: 0, propBeechBias: 0, propStyle: 'none' },
};

const PLACE_TERRAIN = {
    river_ford: 'marsh',
    marshes_edge: 'reeds',
    teutoburg_fringe: 'forest',
    corduroy_road: 'road',
    lippe_valley: 'road',
    scorched_land: 'scorched',
    aliso_gate: 'road',
    ridge_trail: 'peat_bog',
    peat_bog_wetlands: 'peat_bog',
    ems_riverbank: 'river',
    bog_turlough: 'peat_bog',
    ampsivarii_outpost: 'terp',
    alpine_forest_and_ravines: 'alpine',
};

const PLACE_EVENT_POOLS = {
    river_ford: ['ford_ambush', 'cold_crossing'],
    marshes_edge: ['bog_mire', 'lost_dispatch', 'reed_stealth', 'mud_weapon'],
    teutoburg_fringe: ['forest_silence', 'distant_horn', 'scout_tracks', 'wildlife_stir'],
    corduroy_road: ['broken_stone', 'straggler', 'corduroy_path'],
    lippe_valley: ['road_dust', 'deserter_rumor', 'lippe_mist'],
    scorched_land: ['scorched_village', 'hanged_trees', 'ash_wind', 'tiberius_road'],
    aliso_gate: ['gate_hope', 'eagle_gone', 'final_pursuit'],
    ridge_trail: ['ridge_wind', 'tracker', 'north_fork'],
    peat_bog_wetlands: ['peat_fog', 'bructeri_patrol', 'dead_trees'],
    ems_riverbank: ['canoe_splash', 'river_mist', 'exposed_bank'],
    bog_turlough: ['bog_mire', 'bog_stench', 'turlough_sink'],
    ampsivarii_outpost: ['ampsivarii_parley', 'boiocalus_chains', 'terp_refuge'],
    alpine_forest_and_ravines: ['chatti_line', 'ravine_echo', 'timber_barrier', 'suebi_horn'],
};

const EXTRA_EVENT_POOLS = ['wolf_sign', 'smoke_signal', 'empty_camp', 'raven_call'];

function layoutToGrid(x, y, meta) {
    const gx = meta.margin + (x - meta.minX) * meta.cellW + meta.cellW * 0.5;
    const gy = meta.margin + (y - meta.minY) * meta.cellH + meta.cellH * 0.5;
    return { gx, gy };
}

/**
 * @param {{ id: string, placeId?: string | null, layoutX?: number, layoutY?: number }} seed
 * @param {number} worldSeed
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} gridMeta
 */
function pickTerrain(seed, worldSeed, gridMeta) {
    if (seed.placeId && PLACE_TERRAIN[seed.placeId]) return PLACE_TERRAIN[seed.placeId];

    const midX = (gridMeta.minX + gridMeta.maxX) / 2;
    const midY = (gridMeta.minY + gridMeta.maxY) / 2;
    const lx = seed.layoutX ?? midX;
    const ly = seed.layoutY ?? midY;
    const rnd = mulberry32(stableHash32(`${worldSeed}|terrain|${seed.id}`));
    const r = rnd();

    if (ly < midY - 0.5) {
        if (r < 0.5) return 'peat_bog';
        if (r < 0.75) return 'river';
        return 'terp';
    }
    if (ly > midY + 0.5) {
        if (r < 0.6) return 'alpine';
        if (r < 0.85) return 'forest';
        return 'hillfort';
    }
    if (lx > midX + 0.5) {
        if (r < 0.45) return 'reeds';
        if (r < 0.7) return 'marsh';
        return 'forest';
    }
    if (lx < midX - 0.5) {
        if (r < 0.35) return 'scorched';
        if (r < 0.6) return 'road';
        if (r < 0.8) return 'river';
        return 'forest';
    }
    if (r < 0.4) return 'forest';
    if (r < 0.65) return 'marsh';
    if (r < 0.85) return 'road';
    return 'peat_bog';
}

function buildEventPool(regionId, placeId, terrain, worldSeed) {
    if (placeId && PLACE_EVENT_POOLS[placeId]) return [...PLACE_EVENT_POOLS[placeId]];
    const rnd = mulberry32(stableHash32(`${worldSeed}|events|${regionId}`));
    const pool = [...EXTRA_EVENT_POOLS];
    if (terrain === 'marsh' || terrain === 'reeds' || terrain === 'peat_bog') pool.push('bog_stench');
    if (terrain === 'forest' || terrain === 'alpine') pool.push('branch_snap');
    if (terrain === 'scorched') pool.push('ash_wind');
    if (terrain === 'river') pool.push('river_mist');
    return pool.filter(() => rnd() > 0.35).slice(0, 4);
}

/**
 * @param {typeof import('../world.js').default} World
 * @param {ReturnType<typeof computeGridMeta>} gridMeta
 * @param {{ worldSeed?: number, extraSeedCount?: number, lloydIterations?: number }} options
 */
export function buildWorldMap(World, gridMeta, options = {}) {
    const worldSeed = options.worldSeed ?? 42;
    const extraSeedCount = options.extraSeedCount ?? 3;
    const lloydIterations = options.lloydIterations ?? 4;
    const rnd = mulberry32(worldSeed);

    const seeds = [];
    for (const { id, x, y } of gridMeta.positions) {
        const { gx, gy } = layoutToGrid(x, y, gridMeta);
        seeds.push({
            id,
            placeId: id,
            layoutX: x,
            layoutY: y,
            gx,
            gy,
        });
    }

    const layoutSpanX = gridMeta.maxX - gridMeta.minX + 1;
    const layoutSpanY = gridMeta.maxY - gridMeta.minY + 1;
    for (let i = 0; i < extraSeedCount; i++) {
        const lx = gridMeta.minX + rnd() * Math.max(layoutSpanX, 1);
        const ly = gridMeta.minY + rnd() * Math.max(layoutSpanY, 1);
        const { gx, gy } = layoutToGrid(lx, ly, gridMeta);
        seeds.push({
            id: `territory_${i}`,
            placeId: null,
            layoutX: lx,
            layoutY: ly,
            gx,
            gy,
        });
    }

    let regionIndex = assignCellsToNearestSeed(gridMeta.cols, gridMeta.rows, seeds);
    const relaxed = lloydRelax(regionIndex, seeds, lloydIterations);
    regionIndex = relaxed.regionIndex;
    const finalSeeds = relaxed.seeds;

    const seedIndexById = finalSeeds.map((s, i) => ({ ...s, seedIndex: i }));
    const regions = {};

    for (const seed of seedIndexById) {
        const terrain = pickTerrain(seed, worldSeed, gridMeta);
        const table = TERRAIN_TABLE[terrain] ?? TERRAIN_TABLE.forest;
        const bbox = regionBBox(regionIndex, seed.seedIndex);
        regions[seed.id] = {
            id: seed.id,
            placeId: seed.placeId,
            seedIndex: seed.seedIndex,
            terrain,
            groundChar: table.groundChar,
            propDensity: table.propDensity,
            propBeechBias: table.propBeechBias,
            propStyle: table.propStyle ?? 'beech',
            eventPool: buildEventPool(seed.id, seed.placeId, terrain, worldSeed),
            bbox,
            gx: seed.gx,
            gy: seed.gy,
        };
    }

    const regionIdAt = (gx, gy) => {
        const si = regionIndex[gy]?.[gx];
        if (si == null) return null;
        return finalSeeds[si]?.id ?? null;
    };

    return {
        worldSeed,
        bounds: {
            minX: gridMeta.minX,
            minY: gridMeta.minY,
            maxX: gridMeta.maxX,
            maxY: gridMeta.maxY,
        },
        cols: gridMeta.cols,
        rows: gridMeta.rows,
        seeds: finalSeeds,
        regionIndex,
        regions,
        regionIdAt,
        getRegionForPlace(placeId) {
            return regions[placeId] ?? null;
        },
    };
}
