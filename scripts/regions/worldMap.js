import { stableHash32, mulberry32 } from '../util/random.js';
import {
    assignCellsToNearestSeed,
    lloydRelax,
    regionBBox,
} from './voronoi.js';

const TERRAIN_TABLE = {
    forest: { groundChar: '.', propDensity: 0.08, propBeechBias: 0.5 },
    marsh: { groundChar: '~', propDensity: 0.03, propBeechBias: 0.2 },
    road: { groundChar: '=', propDensity: 0.02, propBeechBias: 0.3 },
};

const PLACE_TERRAIN = {
    teutoburg_fringe: 'forest',
    broken_milestone: 'road',
    river_ford: 'marsh',
    ridge_trail: 'forest',
    marshes_edge: 'marsh',
    long_march_west: 'road',
    aliso_gate: 'road',
};

const PLACE_EVENT_POOLS = {
    teutoburg_fringe: ['forest_silence', 'distant_horn'],
    broken_milestone: ['broken_stone', 'straggler'],
    river_ford: ['ford_ambush', 'cold_crossing'],
    ridge_trail: ['ridge_wind', 'tracker'],
    marshes_edge: ['bog_mire', 'lost_dispatch'],
    long_march_west: ['road_dust', 'deserter_rumor'],
    aliso_gate: ['gate_hope', 'eagle_gone'],
};

const EXTRA_EVENT_POOLS = ['wolf_sign', 'smoke_signal', 'empty_camp', 'raven_call'];

function layoutToGrid(x, y, meta) {
    const gx = meta.margin + (x - meta.minX) * meta.cellW + meta.cellW * 0.5;
    const gy = meta.margin + (y - meta.minY) * meta.cellH + meta.cellH * 0.5;
    return { gx, gy };
}

function pickTerrain(regionId, placeId, worldSeed) {
    if (placeId && PLACE_TERRAIN[placeId]) return PLACE_TERRAIN[placeId];
    const rnd = mulberry32(stableHash32(`${worldSeed}|terrain|${regionId}`));
    const r = rnd();
    if (r < 0.55) return 'forest';
    if (r < 0.8) return 'marsh';
    return 'road';
}

function buildEventPool(regionId, placeId, terrain, worldSeed) {
    if (placeId && PLACE_EVENT_POOLS[placeId]) return [...PLACE_EVENT_POOLS[placeId]];
    const rnd = mulberry32(stableHash32(`${worldSeed}|events|${regionId}`));
    const pool = [...EXTRA_EVENT_POOLS];
    if (terrain === 'marsh') pool.push('bog_stench');
    if (terrain === 'forest') pool.push('branch_snap');
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
        const terrain = pickTerrain(seed.id, seed.placeId, worldSeed);
        const table = TERRAIN_TABLE[terrain];
        const bbox = regionBBox(regionIndex, seed.seedIndex);
        regions[seed.id] = {
            id: seed.id,
            placeId: seed.placeId,
            seedIndex: seed.seedIndex,
            terrain,
            groundChar: table.groundChar,
            propDensity: table.propDensity,
            propBeechBias: table.propBeechBias,
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
