import { VoxelScene } from '../VoxelScene.js';
import { UI } from '../UI.js';
import { Controls } from '../Controls.js';

const canvas = document.getElementById('threeCanvas');

const params = {
  spacing: 1.05,
  voxelSize: 0.9,
  dragCarve: false,
  tool: 'orbit',
  paintColor: '#ffffff',
  brushSize: 1
};

const grid = { x: 12, y: 12, z: 8 };

const voxelScene = new VoxelScene(canvas, params, grid);
const controls = new Controls(voxelScene.camera, voxelScene.renderer);
voxelScene.setControls(controls.instance);

const ui = new UI(params, voxelScene);

// Pointer interaction forwarding (keeps behavior from original main.js)
let isDragging = false;
let pointerDown = false;

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  isDragging = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  isDragging = true;
  const isOrbiting = controls.instance.userData && controls.instance.userData.isOrbiting ? controls.instance.userData.isOrbiting() : false;
  if (params.dragCarve && !isOrbiting) voxelScene.handlePointer(e, params, false);
});

canvas.addEventListener('pointerup', (e) => {
  const wasDragging = isDragging;
  pointerDown = false;
  isDragging = false;
  const isOrbiting = controls.instance.userData && controls.instance.userData.isOrbiting ? controls.instance.userData.isOrbiting() : false;
  if (!wasDragging && !isOrbiting) voxelScene.handlePointer(e, params, true);
});

window.addEventListener('resize', () => voxelScene.resize());

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  voxelScene.render();
}

animate();

// Debug helpers
window.__voxelDebug = {
  removedArray: voxelScene.removed,
  reset: () => voxelScene.resetVoxels()
};
