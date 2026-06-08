import { stableHash32, mulberry32 } from '../util/random.js';

/** @typedef {'generic' | 'unique'} AllyKind */
/** @typedef {'melee' | 'ranged' | 'support'} AllyRole */

/**
 * @typedef {{
 *  id: string,
 *  name: string,
 *  kind: AllyKind,
 *  role: AllyRole,
 *  hp: number,
 *  maxHp: number,
 *  atk: number,
 *  skills: string[],
 *  terrainTags: string[],
 * }} AllyTemplate
 */

/** @type {Record<string, AllyTemplate>} */
export const ALLY_TEMPLATES = {
    straggler_legionary: {
        id: 'straggler_legionary',
        name: 'Legionary Straggler',
        kind: 'generic',
        role: 'melee',
        hp: 10,
        maxHp: 10,
        atk: 3,
        skills: ['shield_bash'],
        terrainTags: ['marsh', 'reeds', 'peat_bog'],
    },
};

/**
 * @param {string} templateId
 */
export function getAllyTemplate(templateId) {
    return ALLY_TEMPLATES[templateId] ?? null;
}

/**
 * @param {string} templateId
 * @param {number} [seed]
 */
export function createAllyFromTemplate(templateId, seed = Date.now()) {
    const template = getAllyTemplate(templateId);
    if (!template) return null;
    const rng = mulberry32(stableHash32(`${templateId}|${seed}`));
    const hpBump = rng() < 0.25 ? 1 : 0;
    return {
        instanceId: `${templateId}_${Math.floor(rng() * 1_000_000)}`,
        templateId: template.id,
        name: template.name,
        kind: template.kind,
        role: template.role,
        hp: template.hp + hpBump,
        maxHp: template.maxHp + hpBump,
        atk: template.atk,
        skills: [...template.skills],
    };
}

/**
 * @param {{ hp: number, atk: number }[]} allies
 */
export function getAlliesAttackPower(allies) {
    return allies.reduce((sum, ally) => sum + Math.max(0, ally.atk ?? 0), 0);
}
