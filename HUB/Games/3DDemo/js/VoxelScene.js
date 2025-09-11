import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

export class VoxelScene {
  constructor(canvas, params, grid) {
    this.canvas = canvas;
    this.params = params;
    this.grid = grid;
    this.totalCount = grid.x * grid.y * grid.z;
    this.removed = new Uint8Array(this.totalCount);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.instancedMesh = null;
    this._init();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600, false);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);
    this.camera = new THREE.PerspectiveCamera(50, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(this.grid.x, this.grid.z * 1.5, this.grid.y * 1.8);
    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(0, 20, 10);
    this.scene.add(dir);
    // Raycaster
    this.raycaster = new THREE.Raycaster();
    // Controls (OrbitControlsは外部でセット)
    // Voxels
    this.createVoxels();
  }

  setControls(controls) {
    this.controls = controls;
  }

  createVoxels() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      this.instancedMesh.material.dispose();
      this.instancedMesh = null;
    }
    this.totalCount = this.grid.x * this.grid.y * this.grid.z;
    this.removed = new Uint8Array(this.totalCount);
    const boxGeo = new THREE.BoxGeometry(this.params.voxelSize, this.params.voxelSize, this.params.voxelSize);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6, vertexColors: true });
    this.instancedMesh = new THREE.InstancedMesh(boxGeo, mat, this.totalCount);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    let i = 0;
    const offsetX = -(this.grid.x - 1) * this.params.spacing * 0.5;
    const offsetY = -(this.grid.z - 1) * this.params.spacing * 0.5;
    const offsetZ = -(this.grid.y - 1) * this.params.spacing * 0.5;
    for (let iz = 0; iz < this.grid.z; iz++) {
      for (let iy = 0; iy < this.grid.y; iy++) {
        for (let ix = 0; ix < this.grid.x; ix++) {
          const x = offsetX + ix * this.params.spacing;
          const y = offsetY + iz * this.params.spacing;
          const z = offsetZ + iy * this.params.spacing;
          dummy.position.set(x, y, z);
          dummy.updateMatrix();
          this.instancedMesh.setMatrixAt(i, dummy.matrix);
          // 色
          const h = (ix / Math.max(1, this.grid.x - 1)) * 0.6 + (iy / Math.max(1, this.grid.y - 1)) * 0.2;
          const s = 0.6;
          const l = 0.5 - (iz / Math.max(1, this.grid.z - 1)) * 0.12;
          const color = new THREE.Color().setHSL(h, s, l);
          if (typeof this.instancedMesh.setColorAt === 'function') {
            this.instancedMesh.setColorAt(i, color);
          }
          i++;
        }
      }
    }
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.scene.add(this.instancedMesh);
  }

  carveVoxel(index) {
    if (this.removed[index]) return;
    this.removed[index] = 1;
    const dummy = new THREE.Object3D();
    this.instancedMesh.getMatrixAt(index, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    this.instancedMesh.setMatrixAt(index, dummy.matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  paintVoxel(index, colorHex) {
    if (!this.instancedMesh) return;
    if (this.removed[index]) return;
    if (typeof this.instancedMesh.setColorAt === 'function') {
      const c = new THREE.Color(colorHex);
      this.instancedMesh.setColorAt(index, c);
      if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  handlePointer(event, params, singleClick = false) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const intersects = this.raycaster.intersectObject(this.instancedMesh);
    if (intersects.length === 0) return;
    const instId = intersects[0].instanceId;
    if (instId === undefined || instId === null) return;
    if (params.tool === 'carve') {
      this.carveVoxel(instId);
    } else if (params.tool === 'brushCarve') {
      // 中心インデックスから半径内を一括彫刻
      const cx = instId % this.grid.x;
      const tmp = Math.floor(instId / this.grid.x);
      const cy = tmp % this.grid.y;
      const cz = Math.floor(tmp / this.grid.y);
      const radius = Math.max(0.5, params.brushSize);
      for (let iz = 0; iz < this.grid.z; iz++) {
        for (let iy = 0; iy < this.grid.y; iy++) {
          for (let ix = 0; ix < this.grid.x; ix++) {
            const dx = ix - cx, dy = iy - cy, dz = iz - cz;
            if (Math.sqrt(dx*dx+dy*dy+dz*dz) <= radius) {
              const idx = iz * (this.grid.x * this.grid.y) + iy * this.grid.x + ix;
              this.carveVoxel(idx);
            }
          }
        }
      }
    } else if (params.tool === 'paint') {
      this.paintVoxel(instId, params.paintColor);
    }
  }

  resetVoxels() {
    this.createVoxels();
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement.clientHeight || window.innerHeight * 0.7;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

