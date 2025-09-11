export class UI {
  constructor(params, voxelScene) {
    this.params = params;
    this.voxelScene = voxelScene;
    this._setup();
  }
  _setup() {
    const toolOrbit = document.getElementById('toolOrbit');
    const toolCarve = document.getElementById('toolCarve');
    const toolBrush = document.getElementById('toolBrush');
    const toolPaint = document.getElementById('toolPaint');
    const colorEl = document.getElementById('voxelColor');
    const brushEl = document.getElementById('brushSize');
    const brushLabel = document.getElementById('brushSizeLabel');
    function updateControlsEnabled() {
      // controls.enabledはmain.jsで設定
    }
    if (toolOrbit) toolOrbit.addEventListener('change', () => { this.params.tool = 'orbit'; updateControlsEnabled(); });
    if (toolCarve) toolCarve.addEventListener('change', () => { this.params.tool = 'carve'; updateControlsEnabled(); });
    if (toolBrush) toolBrush.addEventListener('change', () => { this.params.tool = 'brushCarve'; updateControlsEnabled(); });
    if (toolPaint) toolPaint.addEventListener('change', () => { this.params.tool = 'paint'; updateControlsEnabled(); });
    if (colorEl) colorEl.addEventListener('input', (e) => this.params.paintColor = e.target.value);
    if (brushEl) {
      brushEl.addEventListener('input', (e) => {
        this.params.brushSize = parseFloat(e.target.value);
        if (brushLabel) brushLabel.textContent = this.params.brushSize.toFixed(1);
      });
    }
    // Resetボタン
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.voxelScene.resetVoxels());
    // Drag carve
    const dragEl = document.getElementById('dragCarve');
    if (dragEl) {
      this.params.dragCarve = dragEl.checked;
      dragEl.addEventListener('change', (e) => this.params.dragCarve = e.target.checked);
    }
  }
}