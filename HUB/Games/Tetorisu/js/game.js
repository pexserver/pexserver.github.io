'use strict';
(() => {
  const COLS = 10, ROWS = 20, CELL = 24;
  const boardCanvas = document.getElementById('board');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // device pixel ratio scaling
  const DPR = window.devicePixelRatio || 1;
  boardCanvas.style.width = (COLS * CELL) + 'px';
  boardCanvas.style.height = (ROWS * CELL) + 'px';
  boardCanvas.width = COLS * CELL * DPR;
  boardCanvas.height = ROWS * CELL * DPR;
  ctx.scale(DPR, DPR);

  nextCanvas.style.width = '80px';
  nextCanvas.style.height = '80px';
  nextCanvas.width = 80 * DPR;
  nextCanvas.height = 80 * DPR;
  nctx.scale(DPR, DPR);

  const shapes = {
    I: [[1,1,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0]],
    T: [[0,1,0],[1,1,1]],
    Z: [[1,1,0],[0,1,1]]
  };
  const colors = {I:'#00f0f0',J:'#0000f0',L:'#f0a000',O:'#f0f000',S:'#00f000',T:'#a000f0',Z:'#f00000'};

  function createMatrix(cols,rows){
    const m = [];
    for(let r=0;r<rows;r++) m.push(new Array(cols).fill(0));
    return m;
  }
  const grid = createMatrix(COLS, ROWS);

  function rotate(matrix){
    const m = matrix.map((row, i) => row.map((_, j) => matrix[matrix.length-1-j][i]));
    return m;
  }

  function randomPiece(){
    const keys = Object.keys(shapes);
    const k = keys[Math.floor(Math.random()*keys.length)];
    return {shape: shapes[k].map(r=>r.slice()), type:k, x: Math.floor((COLS - shapes[k][0].length)/2), y: 0};
  }

  let piece = randomPiece();
  let next = randomPiece();
  let dropCounter = 0, dropInterval = 500;
  let lastTime = 0;
  let score = 0;
  let paused = false;
  let gameOver = false;

  // input auto-repeat
  const keyState = {};
  const keyTimers = {};
  const initialDelay = 180; // ms before repeat
  const repeatInterval = 60; // ms between repeats

  function setRepeat(key, action) {
    if(keyTimers[key]) return;
    // immediate
    action();
    // start delay then interval
    const t = setTimeout(() => {
      keyTimers[key] = setInterval(action, repeatInterval);
    }, initialDelay);
    keyTimers[key] = t;
  }
  function clearRepeat(key) {
    const v = keyTimers[key];
    if(!v) return;
    clearTimeout(v);
    clearInterval(v);
    delete keyTimers[key];
  }

  function collide(grid, piece){
    for(let y=0;y<piece.shape.length;y++){
      for(let x=0;x<piece.shape[y].length;x++){
        if(piece.shape[y][x]){
          const gx = piece.x + x;
          const gy = piece.y + y;
          if(gy<0) continue;
          if(gx<0 || gx>=COLS || gy>=ROWS) return true;
          if(grid[gy][gx]) return true;
        }
      }
    }
    return false;
  }

  function merge(grid,piece){
    for(let y=0;y<piece.shape.length;y++){
      for(let x=0;x<piece.shape[y].length;x++){
        if(piece.shape[y][x]){
          grid[piece.y+y][piece.x+x] = piece.type;
        }
      }
    }
  }

  function clearLines(){
    let rowCount=0;
    outer: for(let y=ROWS-1;y>=0;y--){
      for(let x=0;x<COLS;x++) if(!grid[y][x]) { continue outer; }
      // full
      grid.splice(y,1);
      grid.unshift(new Array(COLS).fill(0));
      rowCount++;
      y++; // recheck same y after splice
    }
    if(rowCount>0){
      const points = [0,40,100,300,1200];
      score += points[rowCount] || 0;
      scoreEl.textContent = score;
      dropInterval = Math.max(100, 500 - Math.floor(score/100));
    }
  }

  function spawnPieceFromNext(){
    piece = next;
    next = randomPiece();
    piece.x = Math.floor((COLS - piece.shape[0].length)/2);
    piece.y = 0;
    if(collide(grid,piece)){
      // game over
      gameOver = true;
      paused = true;
    }
  }

  function playerDrop(){
    if(gameOver) return;
    piece.y++;
    if(collide(grid,piece)){
      piece.y--;
      merge(grid,piece);
      spawnPieceFromNext();
      clearLines();
    }
    dropCounter = 0;
  }

  function hardDrop(){
    if(gameOver) return;
    while(!collide(grid, {...piece, y: piece.y+1})) piece.y++;
    playerDrop();
  }

  function playerMove(dir){
    if(gameOver) return;
    piece.x += dir;
    if(collide(grid,piece)) piece.x -= dir;
  }

  function playerRotate(){
    if(gameOver) return;
    const rotated = rotate(piece.shape);
    const oldX = piece.x;
    piece.shape = rotated;
    // wall kicks simple
    let offset=0;
    while(collide(grid,piece)){
      offset = offset ? -offset : 1;
      piece.x += offset;
      if(Math.abs(offset) > piece.shape[0].length){ piece.shape = rotate(rotate(rotate(piece.shape))); piece.x = oldX; return; }
    }
  }

  function drawCell(x,y,color){
    ctx.fillStyle = color;
    ctx.fillRect(x*CELL, y*CELL, CELL-1, CELL-1);
  }

  function draw(){
    // clear board
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
    // grid
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const v = grid[y][x];
        if(v){ drawCell(x,y,colors[v] || '#888'); }
      }
    }
    // piece
    if(piece){
      for(let y=0;y<piece.shape.length;y++){
        for(let x=0;x<piece.shape[y].length;x++){
          if(piece.shape[y][x]) drawCell(piece.x+x, piece.y+y, colors[piece.type]);
        }
      }
    }

    // next (centered)
    nctx.fillStyle = '#000'; nctx.fillRect(0,0,80,80);
    const size = 16;
    const p = next;
    if(p){
      const w = p.shape[0].length * size;
      const h = p.shape.length * size;
      const offsetX = Math.floor((80 - w)/2 / size);
      const offsetY = Math.floor((80 - h)/2 / size);
      for(let y=0;y<p.shape.length;y++){
        for(let x=0;x<p.shape[y].length;x++){
          if(p.shape[y][x]){
            nctx.fillStyle = colors[p.type];
            nctx.fillRect((x+offsetX)*size, (y+offsetY)*size, size-2, size-2);
          }
        }
      }
    }

    // overlays
    if(paused){
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gameOver ? 'GAME OVER' : 'PAUSED', (COLS*CELL)/2, (ROWS*CELL)/2);
      if(gameOver){
        ctx.font = '12px sans-serif';
        ctx.fillText('Press R to restart', (COLS*CELL)/2, (ROWS*CELL)/2 + 24);
      }
    }
  }

  function update(time=0){
    if(lastTime === 0) lastTime = time;
    if(paused){ requestAnimationFrame(update); return; }
    const delta = time - lastTime; lastTime = time;
    dropCounter += delta;
    if(dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
  }

  document.addEventListener('keydown', e=>{
    if(e.repeat) {
      // ignore native repeats; we implement our own
      e.preventDefault();
    }
    const k = e.key;
    if(k === 'ArrowLeft'){
      if(!keyState.ArrowLeft){ keyState.ArrowLeft = true; setRepeat('ArrowLeft', ()=>playerMove(-1)); }
    } else if(k === 'ArrowRight'){
      if(!keyState.ArrowRight){ keyState.ArrowRight = true; setRepeat('ArrowRight', ()=>playerMove(1)); }
    } else if(k === 'ArrowDown'){
      if(!keyState.ArrowDown){ keyState.ArrowDown = true; setRepeat('ArrowDown', ()=>playerDrop()); }
    } else if(k === 'ArrowUp'){
      playerRotate();
    } else if(e.code === 'Space') { e.preventDefault(); hardDrop(); }
    else if(k.toLowerCase() === 'p'){
      if(!gameOver){ paused = !paused; if(!paused) { lastTime = performance.now(); } }
    } else if(k.toLowerCase() === 'r'){
      if(gameOver){
        // restart
        for(let r=0;r<ROWS;r++) grid[r].fill(0);
        score = 0; scoreEl.textContent = score;
        dropInterval = 500; gameOver = false; paused = false;
        piece = randomPiece(); next = randomPiece();
        lastTime = performance.now();
      }
    }
  });

  document.addEventListener('keyup', e=>{
    const k = e.key;
    if(k === 'ArrowLeft'){ keyState.ArrowLeft = false; clearRepeat('ArrowLeft'); }
    else if(k === 'ArrowRight'){ keyState.ArrowRight = false; clearRepeat('ArrowRight'); }
    else if(k === 'ArrowDown'){ keyState.ArrowDown = false; clearRepeat('ArrowDown'); }
  });

  // init
  piece = randomPiece(); next = randomPiece();
  scoreEl.textContent = score;
  requestAnimationFrame(update);
})();
