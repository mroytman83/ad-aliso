import World from './world.js';
import { renderWorldMap } from './asciiMap.js';

const canvas = document.getElementById('map-canvas');
if (canvas) {
    renderWorldMap(canvas, World, { currentPlaceId: 'teutoburg_fringe' });
}
