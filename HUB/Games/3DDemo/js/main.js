import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('threeCanvas');
let renderer, scene, camera, controls, raycaster;
let instancedMesh;
let grid = { x: 12, y: 12, z: 8 };
let totalCount = grid.x * grid.y * grid.z;
let removed = new Uint8Array(totalCount); // 0 = present, 1 = removed

const params = {
  spacing: 1.05,
  voxelSize: 0.9,
  dragCarve: false,
  tool: 'orbit',
  paintColor: '#ffffff',
  brushSize: 1
};

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);

  // Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);
  camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(grid.x, grid.z * 1.5, grid.y * 1.8);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 50, 0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(0, 20, 10);
  scene.add(dir);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Track when user is orbiting (to avoid carving while orbiting)
  let isOrbiting = false;
  controls.addEventListener('start', () => { isOrbiting = true; });
  controls.addEventListener('end', () => { isOrbiting = false; });

  // Raycaster
  raycaster = new THREE.Raycaster();

  // Create voxel instanced mesh
  createVoxels();

  // Event listeners
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  document.getElementById('resetBtn').addEventListener('click', resetVoxels);
  const dragEl = document.getElementById('dragCarve');
  params.dragCarve = dragEl.checked;
  dragEl.addEventListener('change', (e) => params.dragCarve = e.target.checked);

  // Ensure renderer and camera use the actual element size on load
  onWindowResize();

  // Expose orbit flag for other handlers
  // (store on controls object to be accessible in outer scope handlers)
  controls.userData = controls.userData || {};
  controls.userData.isOrbiting = () => isOrbiting;
}

function createVoxels() {
  if (instancedMesh) {
    scene.remove(instancedMesh);
    instancedMesh.geometry.dispose();
    instancedMesh.material.dispose();
    instancedMesh = null;
  }

  totalCount = grid.x * grid.y * grid.z;
  removed = new Uint8Array(totalCount);

  const boxGeo = new THREE.BoxGeometry(params.voxelSize, params.voxelSize, params.voxelSize);
  // enable vertex colors so per-instance colors render
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6, vertexColors: true });
  instancedMesh = new THREE.InstancedMesh(boxGeo, mat, totalCount);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  let i = 0;
  const offsetX = -(grid.x - 1) * params.spacing * 0.5;
  const offsetY = -(grid.z - 1) * params.spacing * 0.5; // height
  const offsetZ = -(grid.y - 1) * params.spacing * 0.5;

  // Prepare an instance color buffer via setColorAt
  for (let iz = 0; iz < grid.z; iz++) {
    for (let iy = 0; iy < grid.y; iy++) {
      for (let ix = 0; ix < grid.x; ix++) {
        const x = offsetX + ix * params.spacing;
        const y = offsetY + iz * params.spacing;
        const z = offsetZ + iy * params.spacing;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        // choose a color per-voxel (hue based on x/y/z for variety)
        const h = (ix / Math.max(1, grid.x - 1)) * 0.6 + (iy / Math.max(1, grid.y - 1)) * 0.2;
        const s = 0.6;
        const l = 0.5 - (iz / Math.max(1, grid.z - 1)) * 0.12;
        const color = new THREE.Color().setHSL(h, s, l);
        if (typeof instancedMesh.setColorAt === 'function') {
          instancedMesh.setColorAt(i, color);
        }

        i++;
      }
    }
  }

  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;
  scene.add(instancedMesh);
}

let isDragging = false;
let pointerDown = false;

function onPointerDown(event) {
  pointerDown = true;
  isDragging = false;
  // don't carve immediately on pointerdown to avoid carving when user begins an orbit drag
}

function onPointerMove(event) {
  if (!pointerDown) return;
  isDragging = true;
  // only carve while dragging if dragCarve enabled AND user is not orbiting
  const isOrbiting = controls.userData && controls.userData.isOrbiting ? controls.userData.isOrbiting() : false;
  if (params.dragCarve && !isOrbiting) handlePointer(event, false);
}

function onPointerUp(event) {
  const wasDragging = isDragging;
  pointerDown = false;
  isDragging = false;
  const isOrbiting = controls.userData && controls.userData.isOrbiting ? controls.userData.isOrbiting() : false;
  // Single click (no significant drag) -> carve on click (if not orbiting)
  if (!wasDragging && !isOrbiting) {
    handlePointer(event, true);
  }
}

// --- ツールUIと状態管理 ---
(function setupToolUI() {
  const toolOrbit = document.getElementById('toolOrbit');
  const toolCarve = document.getElementById('toolCarve');
  const toolBrush = document.getElementById('toolBrush');
  const toolPaint = document.getElementById('toolPaint');
  const colorEl = document.getElementById('voxelColor');
  const brushEl = document.getElementById('brushSize');
  const brushLabel = document.getElementById('brushSizeLabel');

  function updateControlsEnabled() {
    controls.enabled = (params.tool === 'orbit');
  }
  if (toolOrbit) toolOrbit.addEventListener('change', () => { params.tool = 'orbit'; updateControlsEnabled(); });
  if (toolCarve) toolCarve.addEventListener('change', () => { params.tool = 'carve'; updateControlsEnabled(); });
  if (toolBrush) toolBrush.addEventListener('change', () => { params.tool = 'brushCarve'; updateControlsEnabled(); });
  if (toolPaint) toolPaint.addEventListener('change', () => { params.tool = 'paint'; updateControlsEnabled(); });
  if (colorEl) colorEl.addEventListener('input', (e) => params.paintColor = e.target.value);
  if (brushEl) {
    brushEl.addEventListener('input', (e) => {
      params.brushSize = parseFloat(e.target.value);
      if (brushLabel) brushLabel.textContent = params.brushSize.toFixed(1);
    });
  }
  updateControlsEnabled();
})();

// --- handlePointer 分岐 ---
const oldHandlePointer = handlePointer;
function handlePointer(event, singleClick = false) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  const intersects = raycaster.intersectObject(instancedMesh);
  if (intersects.length === 0) return;
  const instId = intersects[0].instanceId;
  if (instId === undefined || instId === null) return;
  if (params.tool === 'carve') {
    carveVoxel(instId);
  } else if (params.tool === 'brushCarve') {
    // 中心インデックスから半径内を一括彫刻
    const cx = instId % grid.x;
    const tmp = Math.floor(instId / grid.x);
    const cy = tmp % grid.y;
    const cz = Math.floor(tmp / grid.y);
    const radius = Math.max(0.5, params.brushSize);
    for (let iz = 0; iz < grid.z; iz++) {
      for (let iy = 0; iy < grid.y; iy++) {
        for (let ix = 0; ix < grid.x; ix++) {
          const dx = ix - cx, dy = iy - cy, dz = iz - cz;
          if (Math.sqrt(dx*dx+dy*dy+dz*dz) <= radius) {
            const idx = iz * (grid.x * grid.y) + iy * grid.x + ix;
            carveVoxel(idx);
          }
        }
      }
    }
  } else if (params.tool === 'paint') {
    paintVoxel(instId, params.paintColor);
  }
}

// --- paintVoxel 実装 ---
function paintVoxel(index, colorHex) {
  if (!instancedMesh) return;
  if (removed[index]) return;
  if (typeof instancedMesh.setColorAt === 'function') {
    const c = new THREE.Color(colorHex);
    instancedMesh.setColorAt(index, c);
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
  }
}

function carveVoxel(index) {
  if (removed[index]) return; // already removed
  removed[index] = 1;
  // scale instance to almost zero to hide
  const dummy = new THREE.Object3D();
  instancedMesh.getMatrixAt(index, dummy.matrix);
  dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
  dummy.scale.set(0.001, 0.001, 0.001);
  dummy.updateMatrix();
  instancedMesh.setMatrixAt(index, dummy.matrix);
  instancedMesh.instanceMatrix.needsUpdate = true;
}

function resetVoxels() {
  createVoxels();
}

function onWindowResize() {
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight * 0.7;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Expose some debug helpers
window.__voxelDebug = {
  removedArray: removed,
  reset: resetVoxels
};