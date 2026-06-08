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
import {
    startBattle,
    playerFight,
    playerOrderAllies,
    playerRun,
    enemyTurn,
    isBattleOver,
} from './combat/battle.js';
import {
    renderBattle,
    mapBattleKey,
    moveMenuCursor,
    menuAction as battleMenuAction,
} from './combat/battleView.js';
import {
    spawnLootables,
    stampLootables,
    clearLootableTile,
} from './loot/lootables.js';
import { findNearbyLootable, createLootSession } from './loot/interact.js';
import { addToInventory, addAllToInventory, inventoryCount } from './loot/inventory.js';
import { createAllyFromTemplate } from './allies/allies.js';
import { renderBagOpen, startBagAnimLoop } from './loot/bagOpenView.js';
import {
    renderLootContents,
    mapLootKey,
    moveLootMenuCursor,
    menuAction as lootMenuAction,
} from './loot/lootContentsView.js';

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

/** @type {(() => void) | null} */
let stopBagAnim = null;

let gameState = {
    mode: 'overworld',
    player: {
        locationId: 'marshes_edge',
        regionId: 'marshes_edge',
        gridX: 0,
        gridY: 0,
        hp: 24,
        maxHp: 24,
        atk: 6,
        inventory: [],
        allies: [],
    },
    worldSeed: WORLD_SEED,
    lastRegionId: null,
    lastPlaceId: null,
    lastEvent: null,
    lastEventPoint: null,
    enterCount: 0,
    pendingBattle: null,
    pendingAllyEncounter: null,
    battle: null,
    allyEncounter: null,
    lootables: [],
    loot: null,
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

function setScreenMode(mode) {
    const mapVp = document.getElementById('map-viewport');
    const battleScreen = document.getElementById('battle-screen');
    const lootOpenScreen = document.getElementById('loot-open-screen');
    const lootContentsScreen = document.getElementById('loot-contents-screen');

    if (mapVp) mapVp.style.display = mode === 'overworld' ? 'inline-block' : 'none';
    if (battleScreen) battleScreen.classList.toggle('active', mode === 'battle');
    if (lootOpenScreen) lootOpenScreen.classList.toggle('active', mode === 'loot_open');
    if (lootContentsScreen) lootContentsScreen.classList.toggle('active', mode === 'loot_contents');
}

function beginPendingBattle() {
    if (!gameState.pendingBattle) return;
    const seed = stableHashFromState();
    const battle = startBattle(gameState.player, gameState.pendingBattle, seed);
    if (!battle) return;

    gameState.battle = battle;
    gameState.mode = 'battle';
    gameState.pendingBattle = null;
    setScreenMode('battle');
    renderBattleScreen();

    document.getElementById('battle-screen')?.focus();
}

function beginPendingAllyEncounter() {
    if (!gameState.pendingAllyEncounter) return;
    gameState.allyEncounter = { ...gameState.pendingAllyEncounter };
    gameState.pendingAllyEncounter = null;
    gameState.mode = 'ally_recruit';
    setScreenMode('overworld');
    updateStatus();
}

function resolveAllyEncounter(recruit) {
    const encounter = gameState.allyEncounter;
    if (!encounter) return;
    if (recruit) {
        const seed = stableHashFromState();
        const ally = createAllyFromTemplate(encounter.templateId, seed);
        if (ally) {
            const duplicate = gameState.player.allies.some(
                (a) => a.templateId === ally.templateId,
            );
            if (duplicate) {
                gameState.lastEvent = {
                    id: 'ally_duplicate',
                    text: `${ally.name} salutes but returns to the line. You already command one.`,
                };
            } else {
                gameState.player.allies.push(ally);
                gameState.lastEvent = {
                    id: 'ally_recruited',
                    text: `${ally.name} joins your command.`,
                };
            }
        }
    } else {
        gameState.lastEvent = {
            id: 'ally_declined',
            text: 'The legionary nods once and disappears into the reeds.',
        };
    }
    gameState.allyEncounter = null;
    gameState.mode = 'overworld';
    render();
}

function stableHashFromState() {
    return (
        gameState.worldSeed ^
        gameState.player.gridX * 31 ^
        gameState.player.gridY * 17 ^
        (gameState.enterCount ?? 0)
    );
}

function endBattle() {
    const battle = gameState.battle;
    if (!battle) return;

    gameState.player.hp = battle.player.hp;
    if (battle.outcome === 'defeat') {
        gameState.player.hp = 1;
        gameState.lastEvent = {
            id: 'battle_defeat',
            text: 'You wake in the mud, stripped of everything but breath.',
        };
    } else if (battle.outcome === 'victory') {
        gameState.lastEvent = {
            id: 'battle_victory',
            text: 'The scavengers flee. You march on, shaking.',
        };
    } else if (battle.outcome === 'escaped') {
        gameState.lastEvent = {
            id: 'battle_escaped',
            text: 'You escape the imps, lungs burning.',
        };
    } else if (battle.outcome === 'fled') {
        gameState.lastEvent = {
            id: 'battle_fled',
            text: 'The imps scatter with their stolen armor.',
        };
    }

    gameState.battle = null;
    gameState.mode = 'overworld';
    setScreenMode('overworld');
    render();
    document.getElementById('map-canvas')?.focus();
}

function getLootInstance() {
    const id = gameState.loot?.instanceId;
    return gameState.lootables.find((l) => l.instanceId === id) ?? null;
}

function beginLootOpen(instance) {
    if (stopBagAnim) {
        stopBagAnim();
        stopBagAnim = null;
    }

    if (instance.introSeen) {
        gameState = createLootSession(gameState, instance, 'loot_contents');
        setScreenMode('loot_contents');
        renderLootContentsScreen();
        document.getElementById('loot-contents-screen')?.focus();
        return;
    }

    gameState = createLootSession(gameState, instance, 'loot_open');
    setScreenMode('loot_open');

    const canvas = document.getElementById('loot-open-canvas');
    if (!canvas) return;

    renderBagOpen(canvas, gameState.loot, 0);

    stopBagAnim = startBagAnimLoop(
        canvas,
        () => gameState.loot,
        () => showLootContents(),
    );

    document.getElementById('loot-open-screen')?.focus();
}

function cancelLoot() {
    if (stopBagAnim) {
        stopBagAnim();
        stopBagAnim = null;
    }

    const inst = getLootInstance();
    const loot = gameState.loot;
    if (inst && loot) {
        inst.introSeen = true;
        inst.remainingItems = loot.remainingItems.map((i) => ({ ...i }));
    }

    gameState.loot = null;
    gameState.mode = 'overworld';
    setScreenMode('overworld');
    render();
    document.getElementById('map-canvas')?.focus();
}

function showLootContents() {
    if (stopBagAnim) {
        stopBagAnim();
        stopBagAnim = null;
    }
    if (!gameState.loot) return;

    const inst = getLootInstance();
    if (inst) inst.introSeen = true;

    gameState.loot.phase = 'contents';
    gameState.mode = 'loot_contents';
    setScreenMode('loot_contents');
    renderLootContentsScreen();
    document.getElementById('loot-contents-screen')?.focus();
}

function finishLoot(message) {
    if (stopBagAnim) {
        stopBagAnim();
        stopBagAnim = null;
    }

    const inst = getLootInstance();
    const loot = gameState.loot;
    if (inst && loot) {
        inst.introSeen = true;
        inst.remainingItems = loot.remainingItems.map((i) => ({ ...i }));
        const bagEmpty = inst.remainingItems.length === 0;
        if (bagEmpty) {
            inst.opened = true;
            clearLootableTile(fullGrid, baseGrid, inst);
        }
    }

    gameState.loot = null;
    gameState.mode = 'overworld';
    setScreenMode('overworld');

    if (message) {
        gameState.lastEvent = { id: 'loot_done', text: message };
    }

    render();
    document.getElementById('map-canvas')?.focus();
}

function renderBattleScreen() {
    const canvas = document.getElementById('battle-canvas');
    if (!canvas || !gameState.battle) return;
    renderBattle(canvas, gameState.battle);
}

function renderLootContentsScreen() {
    const canvas = document.getElementById('loot-contents-canvas');
    if (!canvas || !gameState.loot) return;
    renderLootContents(canvas, gameState.loot);
}

function updateStatus() {
    const statusEl = document.getElementById('location-status');
    const eventEl = document.getElementById('event-log');
    const place = World.getPlace(gameState.player.locationId);
    const title = place?.title ?? gameState.player.locationId;
    const region = worldMap.regions[gameState.player.regionId];
    const regionLabel = region?.placeId ? title : (region?.id ?? 'wilds');
    const invCount = inventoryCount(gameState.player.inventory ?? []);
    const allyCount = gameState.player.allies?.length ?? 0;

    if (statusEl) {
        if (gameState.mode === 'battle') {
            statusEl.textContent = `Battle — Marcus ${gameState.player.hp}/${gameState.player.maxHp} HP`;
        } else if (gameState.mode === 'loot_open') {
            const lootLabel = gameState.loot?.label ?? 'loot';
            statusEl.textContent = `Opening ${lootLabel}… (Esc: return to map)`;
        } else if (gameState.mode === 'loot_contents') {
            statusEl.textContent = `Loot — inventory: ${invCount} item(s) — Esc: return to map`;
        } else if (gameState.mode === 'ally_recruit') {
            statusEl.textContent = `Recruit encounter — Y: recruit, N: decline — allies: ${allyCount}`;
        } else {
            const terrain = region?.terrain ?? '';
            const nearBag = findNearbyLootable(gameState.player, gameState.lootables);
            const bagHint = nearBag ? ' — Enter/E: open bag' : '';
            statusEl.textContent = `${regionLabel} (${terrain}) at [${gameState.player.gridX},${gameState.player.gridY}] — walk arrows/WASD${bagHint} — inv: ${invCount} — allies: ${allyCount}`;
        }
    }

    if (eventEl) {
        if (gameState.lastEvent) {
            const pt = gameState.lastEventPoint;
            const at = pt && gameState.mode === 'overworld' ? ` [${pt.gx},${pt.gy}]` : '';
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

function onBattleKeyDown(e) {
    const battle = gameState.battle;
    if (!battle) return;

    const action = mapBattleKey(battle, e);
    if (!action) return;
    e.preventDefault();

    if (isBattleOver(battle)) {
        if (action === 'confirm') endBattle();
        return;
    }

    if (action === 'fight') {
        playerFight(battle);
        if (!isBattleOver(battle) && battle.phase === 'enemy') enemyTurn(battle);
        if (isBattleOver(battle)) battle.phase = 'end';
        renderBattleScreen();
        updateStatus();
        return;
    }

    if (action === 'run') {
        playerRun(battle);
        if (!isBattleOver(battle) && battle.phase === 'enemy') enemyTurn(battle);
        if (isBattleOver(battle)) battle.phase = 'end';
        renderBattleScreen();
        updateStatus();
        return;
    }

    if (action === 'ally') {
        playerOrderAllies(battle);
        if (!isBattleOver(battle) && battle.phase === 'enemy') enemyTurn(battle);
        if (isBattleOver(battle)) battle.phase = 'end';
        renderBattleScreen();
        updateStatus();
        return;
    }

    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        moveMenuCursor(battle, action);
        renderBattleScreen();
        return;
    }

    if (action === 'confirm') {
        const choice = battleMenuAction(battle);
        if (choice === 'stub') {
            battle.log.push('Not yet — use FIGHT, ALLY, or RUN.');
            renderBattleScreen();
            return;
        }
        if (choice === 'fight') {
            playerFight(battle);
        } else if (choice === 'ally') {
            playerOrderAllies(battle);
        } else if (choice === 'run') {
            playerRun(battle);
        }
        if (!isBattleOver(battle) && battle.phase === 'enemy') enemyTurn(battle);
        if (isBattleOver(battle)) battle.phase = 'end';
        renderBattleScreen();
        updateStatus();
    }
}

function onLootOpenKeyDown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        cancelLoot();
        return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showLootContents();
    }
}

function onLootContentsKeyDown(e) {
    const loot = gameState.loot;
    if (!loot) return;

    if (e.key === 'Escape' && !loot.selectMode) {
        e.preventDefault();
        cancelLoot();
        return;
    }

    const action = mapLootKey(loot, e);
    if (!action) return;
    e.preventDefault();

    if (action === 'back') {
        loot.selectMode = false;
        loot.itemIndex = 0;
        renderLootContentsScreen();
        return;
    }

    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        moveLootMenuCursor(loot, action);
        renderLootContentsScreen();
        return;
    }

    if (action === 'confirm') {
        const choice = lootMenuAction(loot);

        if (choice === 'enter_select') {
            if (loot.remainingItems.length === 0) {
                finishLoot('The bag is empty.');
                return;
            }
            loot.selectMode = true;
            loot.itemIndex = 0;
            renderLootContentsScreen();
            return;
        }

        if (choice === 'leave') {
            finishLoot('You leave the bag where it lies.');
            return;
        }

        if (choice === 'take_all') {
            if (loot.remainingItems.length > 0) {
                addAllToInventory(gameState.player.inventory, loot.remainingItems);
                loot.remainingItems = [];
            }
            finishLoot('You stow what you can carry.');
            return;
        }

        if (choice === 'take_selected_item') {
            const item = loot.remainingItems[loot.itemIndex];
            if (item) {
                addToInventory(gameState.player.inventory, item);
                loot.remainingItems.splice(loot.itemIndex, 1);
                if (loot.remainingItems.length === 0) {
                    finishLoot('You take the last item from the bag.');
                    return;
                }
                if (loot.itemIndex >= loot.remainingItems.length) {
                    loot.itemIndex = loot.remainingItems.length - 1;
                }
                renderLootContentsScreen();
                updateStatus();
            }
        }
    }
}

function onAllyRecruitKeyDown(e) {
    if (!gameState.allyEncounter) return;
    if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        resolveAllyEncounter(true);
        return;
    }
    if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
        e.preventDefault();
        resolveAllyEncounter(false);
    }
}

function tryOpenNearbyLoot(e) {
    if (e.key !== 'Enter' && e.key !== 'e' && e.key !== 'E') return false;
    const hit = findNearbyLootable(gameState.player, gameState.lootables);
    if (!hit) return false;
    e.preventDefault();
    beginLootOpen(hit);
    return true;
}

function onOverworldKeyDown(e) {
    if (tryOpenNearbyLoot(e)) return;

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
        if (gameState.pendingBattle) {
            beginPendingBattle();
            return;
        }
        if (gameState.pendingAllyEncounter) {
            beginPendingAllyEncounter();
            return;
        }
    }
    render();
}

function onKeyDown(e) {
    if (gameState.mode === 'battle') {
        onBattleKeyDown(e);
    } else if (gameState.mode === 'ally_recruit') {
        onAllyRecruitKeyDown(e);
    } else if (gameState.mode === 'loot_open') {
        onLootOpenKeyDown(e);
    } else if (gameState.mode === 'loot_contents') {
        onLootContentsKeyDown(e);
    } else {
        onOverworldKeyDown(e);
    }
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

    gameState.lootables = spawnLootables(worldMap, walkable, WORLD_SEED, spawn);
    stampLootables(fullGrid, baseGrid, gameState.lootables);

    stampPlayer(spawn.gx, spawn.gy);
    gameState = onEnterRegion(gameState, gameState.player.regionId, worldMap, spawn);

    if (gameState.pendingBattle) {
        beginPendingBattle();
    } else if (gameState.pendingAllyEncounter) {
        beginPendingAllyEncounter();
    } else {
        setScreenMode('overworld');
        canvas.tabIndex = 0;
        render();
        canvas.focus();
    }

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('click', () => canvas.focus());
    document.getElementById('battle-screen')?.addEventListener('click', () => {
        document.getElementById('battle-screen')?.focus();
    });
    document.getElementById('loot-open-screen')?.addEventListener('click', () => {
        document.getElementById('loot-open-screen')?.focus();
    });
    document.getElementById('loot-contents-screen')?.addEventListener('click', () => {
        document.getElementById('loot-contents-screen')?.focus();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
