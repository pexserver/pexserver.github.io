import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';

export class Controls {
  constructor(camera, renderer) {
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.isOrbiting = false;
    this.controls.addEventListener('start', () => { this.isOrbiting = true; });
    this.controls.addEventListener('end', () => { this.isOrbiting = false; });
    // userDataで外部から取得できるように
    this.controls.userData = this.controls.userData || {};
    this.controls.userData.isOrbiting = () => this.isOrbiting;
  }
  get instance() {
    return this.controls;
  }
  update() {
    this.controls.update();
  }
}