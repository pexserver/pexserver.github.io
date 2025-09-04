import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

/* ============================================================
   基本ゲーム設定
============================================================ */
const CONFIG = {
  gravity: -30,
  jumpVelocity: 14.5,
  moveSpeed: 8,
  stages: 5,
  lifeMax: 3,
  audio: true,
  bgmVolume: 0.4,
  seVolume: 0.65
};

/* ============================================================
   ユーティリティ
============================================================ */
function clamp(v, min, max){return Math.min(Math.max(v,min),max);} 
function rand(min,max){return Math.random()*(max-min)+min;}

/* ============================================================
   入力管理
============================================================ */
const keys = new Set();
window.addEventListener('keydown', e => {
  // オーバーレイが表示されている間は Space / Enter によるボタン活性化を無効にする
  const overlayVisible = document.querySelector('.overlay.visible') !== null;
  const isActivateKey = (e.code === 'Space' || e.key === ' ' || e.key === 'Enter');
  if (overlayVisible && isActivateKey) { e.preventDefault(); return; }
  keys.add(String(e.key).toLowerCase());
});
window.addEventListener('keyup', e => { keys.delete(String(e.key).toLowerCase()); });

function isJumpPressed(){return keys.has(' ')||keys.has('arrowup')||keys.has('w');}
function axis(){return (keys.has('arrowleft')||keys.has('a')?-1:0)+(keys.has('arrowright')||keys.has('d')?1:0);}

/* ============================================================
   ECSライクなシンプルエンティティ
============================================================ */
class Entity {
  constructor(mesh){
    this.mesh = mesh;
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.type = 'generic';
    this.dead = false;
    this.scoreValue = 0;
  }
}

/* ============================================================
   ゲームワールド
============================================================ */
class Game {
  constructor(){
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,antialias:true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-16,16,9,-9,-100,100); // 32x18ユニットの可視領域
    this.camera.position.z = 10;

    this.stageIndex = 0;
    this.score = 0;
    this.life = CONFIG.lifeMax;
    this.time = 0;
    // ハイスコア管理
    this.highScore = 0;
    try{
      const v = localStorage.getItem('asure_highscore');
      this.highScore = v? parseInt(v,10) : 0;
    }catch(e){ this.highScore = 0; }

    this.entities = [];
    this.player = null;
    this.stageLength = 200; // 1ステージの仮想長さ
    this.checkpoints = [];
    this.lastCheckpointX = 0;

    this.tmpBoxA = new THREE.Box3();
    this.tmpBoxB = new THREE.Box3();

    this.hudLifeEl = document.getElementById('hud-life');
    this.hudScoreEl = document.getElementById('hud-score');
    this.hudStageEl = document.getElementById('hud-stage');
    this.hudTimeEl = document.getElementById('hud-time');
    this.toastEl = document.getElementById('checkpoint-toast');

    this.overlayStart = document.getElementById('overlay-start');
    this.overlayGameover = document.getElementById('overlay-gameover');
    this.overlayCleared = document.getElementById('overlay-cleared');
  this.overlayResults = document.getElementById('overlay-results');
    this.gameoverScoreEl = document.getElementById('gameover-score');
    this.clearedStageEl = document.getElementById('cleared-stage');

  // Results overlay button
  const btnPlayAgain = document.getElementById('btn-playagain');
  if(btnPlayAgain) btnPlayAgain.addEventListener('click', ()=> window.location.reload());

    document.getElementById('btn-start').addEventListener('click',()=>this.start());
  document.getElementById('btn-retry').addEventListener('click',()=>window.location.reload());
    document.getElementById('btn-next').addEventListener('click',()=>this.nextStage());

    // モバイル入力
    this.mobileLeft = false; this.mobileRight=false; this.mobileJump=false;
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');
    if(btnLeft){
      const d=['pointerdown','touchstart']; const u=['pointerup','pointerleave','touchend','touchcancel'];
      d.forEach(e=>btnLeft.addEventListener(e,()=>{this.mobileLeft=true;}));
      d.forEach(e=>btnRight.addEventListener(e,()=>{this.mobileRight=true;}));
      d.forEach(e=>btnJump.addEventListener(e,()=>{this.mobileJump=true;}));
      u.forEach(e=>btnLeft.addEventListener(e,()=>{this.mobileLeft=false;}));
      u.forEach(e=>btnRight.addEventListener(e,()=>{this.mobileRight=false;}));
      u.forEach(e=>btnJump.addEventListener(e,()=>{this.mobileJump=false;}));
    }

    // Audio 管理
    this.audioCtx = null; this.sounds={}; this.bgmSource=null; this.bgmGain=null; this.seGain=null; this.audioReady=false;
    this.initAudio();

    // パーティクルレイヤ
    this.particleLayer = document.createElement('div');
    this.particleLayer.className='particle-layer';
    document.body.appendChild(this.particleLayer);

    window.addEventListener('resize',()=>this.resize());
    this.resize();
    this.animate = this.animate.bind(this);
  this.started = false; // 重複開始防止
    requestAnimationFrame(this.animate);
  }

  resize(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w,h,false);
    const aspect = w/h; // 保持するが今回は固定投影
  }

  start(){
  if(this.started) return; // 二重起動防止 (スペース連打など)
  this.started = true;
  // フォーカスを外して Space/Enter による誤トリガーを防止
  try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
  this.overlayStart.classList.remove('visible');
  if(!this.audioReady) this.resumeAudio();
  this.stageIndex = 0; this.score = 0; this.life = CONFIG.lifeMax; this.time = 0;
  // フォーカス外す (Space 連続 click 防止)
  const active = document.activeElement; if(active && active.blur) active.blur();
  this.loadStage(0);
  }

  showToast(){
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(()=>this.toastEl.classList.remove('show'),2000);
  }

  updateHUD(){
    this.hudStageEl.textContent = (this.stageIndex+1);
    this.hudScoreEl.textContent = this.score;
    this.hudTimeEl.textContent = this.time.toFixed(1);
    this.hudLifeEl.innerHTML = '';
    for(let i=0;i<this.life;i++){
      const span = document.createElement('span');
      span.className='heart';
      this.hudLifeEl.appendChild(span);
    }
  }

  clearWorld(){
    for(const e of this.entities){
      this.scene.remove(e.mesh);
    }
    this.entities.length = 0;
    // 既存プレイヤーメッシュがシーンに残っている可能性があるため確実に削除
    if(this.player && this.player.mesh){
      try{ this.scene.remove(this.player.mesh); }catch(e){}
    }
    this.player = null;
    this.checkpoints.length=0;
  }

  loadStage(idx){
  // Space 連打で複製されるバグ対策: 開始直後の jump フラグをクリア
  this.jumpBuffered=false; this.jumpBufferTimer=0;
  // 前ステージのトーストやパーティクルタイマーをクリア
  clearTimeout(this.toastTimer);
    this.clearWorld();
    this.stageIndex = idx;
    this.stageLength = 220 + idx*40; // 後半長く
    // 背景色
    const bgColors = [0x0b1e39,0x0b2a2e,0x1e1b37,0x2d1e2f,0x222222];
    this.renderer.setClearColor(bgColors[idx%bgColors.length]);

    // 地面(複数セグメント)
    const groundGeo = new THREE.BoxGeometry(20,1,1);
    const groundMat = new THREE.MeshBasicMaterial({color:0x34516f});
    for(let x=0;x<this.stageLength; x+=20){
      const g = new THREE.Mesh(groundGeo,groundMat);
      g.position.set(x, -4.5, 0);
      this.scene.add(g);
      this.entities.push(new Entity(g));
    }

    // プラットフォーム
    const platGeo = new THREE.BoxGeometry(6,0.8,1);
    for(let i=0;i<30;i++){
      const y = rand(-1,5)+(Math.sin(i*0.7+idx)*2);
      const x = rand(10,this.stageLength-20);
      const m = new THREE.Mesh(platGeo,new THREE.MeshBasicMaterial({color:0x486d92}));
      m.position.set(x,y,0);
      this.scene.add(m);
      const e = new Entity(m); e.type='platform'; this.entities.push(e);
    }

    // チェックポイント(旗)
    const cpGeo = new THREE.BoxGeometry(0.5,3,1);
    const cpMat = new THREE.MeshBasicMaterial({color:0xffcc33});
    for(let i=1;i<=3;i++){
      const cp = new THREE.Mesh(cpGeo,cpMat);
      const x = (this.stageLength/4)*i;
      cp.position.set(x,-1.5,0);
      this.scene.add(cp);
      const e = new Entity(cp); e.type='checkpoint'; this.entities.push(e); this.checkpoints.push({x,activated:false});
    }

    // ゴール
    const goalGeo = new THREE.BoxGeometry(2,6,1);
    const goal = new THREE.Mesh(goalGeo,new THREE.MeshBasicMaterial({color:0x66ff88}));
    goal.position.set(this.stageLength + 5, -1,0);
    this.scene.add(goal);
    const goalE = new Entity(goal); goalE.type='goal'; this.entities.push(goalE);

    // プレイヤー
    const playerGeo = new THREE.BoxGeometry(1,1.6,1);
    const playerMat = new THREE.MeshBasicMaterial({color:0x6dd5fa});
  const playerMesh = new THREE.Mesh(playerGeo,playerMat);
  playerMesh.position.set(0,2,0); // 生成時に地形と被らないよう僅かに上
    this.scene.add(playerMesh);
    this.player = new Entity(playerMesh); this.player.type='player';
  this.player.spawnInvul=1; // 1秒無敵

    // 敵
    for(let i=0;i< 25 + idx*5; i++){
      const enemyGeo = new THREE.BoxGeometry(1.2,1.2,1);
      const enemy = new THREE.Mesh(enemyGeo,new THREE.MeshBasicMaterial({color:0xff5577}));
      const ex = rand(10,this.stageLength-5);
      const ey = rand(-3,4);
      enemy.position.set(ex,ey,0);
      this.scene.add(enemy);
  const ee = new Entity(enemy); ee.type='enemy'; ee.scoreValue = 150 + idx*20; ee.dir = Math.random()<0.5?-1:1; 
  // 発射用タイマー（ランダム開始）
  ee.shootTimer = rand(0.6,2.2);
  this.entities.push(ee);
    }

    this.lastCheckpointX = 0;
    this.updateHUD();
  }

  resetStage(keepScore=false){
    this.overlayGameover.classList.remove('visible');
    if(!keepScore){this.score=0; this.life=CONFIG.lifeMax;}
    this.loadStage(this.stageIndex);
  }

  nextStage(){
    this.overlayCleared.classList.remove('visible');
    if(this.stageIndex+1 >= CONFIG.stages){
  // 全ステージクリア -> リザルト表示
  try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
  const resEl = document.getElementById('results-score');
  if(resEl) resEl.textContent = `SCORE: ${this.score}`;
  this.overlayResults.classList.add('visible');
  this.overlayStart.classList.remove('visible');
  this.started = false;
      return;
    }
  // 次ステージロード前に音や再生ループ類をリセットし、確実にGC
  if(this.bgmPlaying){ this.bgmPlaying=false; }
  this.loadStage(this.stageIndex+1);
  }

  playerDie(){
    this.life--;
    if(this.life <=0){
      // ハイスコア更新
      if(this.score > this.highScore){
        this.highScore = this.score;
        try{ localStorage.setItem('asure_highscore', String(this.highScore)); }catch(e){}
      }
      const txt = `スコア: ${this.score} \n ハイスコア: ${this.highScore}`;
      this.gameoverScoreEl.textContent = txt;
      try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
      this.overlayGameover.classList.add('visible');
      this.playSE('damage');
    } else {
      // 最終チェックポイントへ復帰
      this.player.mesh.position.set(this.lastCheckpointX,2,0);
      this.player.vel.set(0,0,0);
      this.showToast();
  this.playSE('damage');
    }
    this.updateHUD();
  }

  activateCheckpoint(x){
    if(x<=this.lastCheckpointX) return;
    this.lastCheckpointX = x;
    this.life = CONFIG.lifeMax;
    this.showToast();
  this.playSE('checkpoint');
    this.updateHUD();
  }

  logic(dt){
    if(!this.player) return;
    this.time += dt; this.updateHUD();
    const p = this.player;
    if(p.spawnInvul>0) p.spawnInvul-=dt;
    // 入力
    const ax = this.getAxis();
    p.vel.x = ax * CONFIG.moveSpeed;
    // ジャンプバッファ: 空中で押して着地即ジャンプ
    if(isJumpPressed() || this.mobileJump){
      this.jumpBuffered = true; this.jumpBufferTimer = 0.15;
    } else if(this.jumpBufferTimer>0){
      // 維持
    }
    if(this.jumpBufferTimer>0) this.jumpBufferTimer -= dt; else this.jumpBuffered=false;
    if(p.onGround && this.jumpBuffered){
      p.vel.y = CONFIG.jumpVelocity;
      p.onGround = false; this.jumpBuffered=false; this.playSE('jump');
      this.spawnJumpParticle(p.mesh.position);
    }
    // 重力
    p.vel.y += CONFIG.gravity * dt;
    // 位置更新
    p.mesh.position.addScaledVector(p.vel, dt);

    // 敵AI & 移動
    for(const e of this.entities){
      if(e.type==='enemy' && !e.dead){
        e.mesh.position.x += Math.sin(this.time* (0.5+ (e.dir*0.3))) * dt * 1.2; // ふらふら
        // ステージ4(インデックス3)以降は弾を撃つ可能性がある
        if(this.stageIndex >= 3){
          e.shootTimer -= dt;
          if(e.shootTimer <= 0){
            // プレイヤーとの距離が十分に離れている場合のみ発砲
            if(this.player){
              const dist = e.mesh.position.distanceTo(this.player.mesh.position);
              const minDist = 6; // これより離れていると射撃する
              if(dist > minDist){
                // 発射
                this.spawnBullet(e.mesh.position, this.player.mesh.position);
                this.playSE('shoot');
              }
            }
            e.shootTimer = rand(1.2,3.0);
          }
        }
      }
    }

    // 弾の更新と当たり判定
    for(const b of this.entities.slice()){
      if(b.type==='bullet' && !b.dead){
        b.mesh.position.addScaledVector(b.vel, dt);
        // lifetime
        b.life = (b.life||3) - dt;
        if(b.life <= 0){ b.dead = true; this.scene.remove(b.mesh); continue; }
        // プレイヤーに当たったらダメージ
        if(this.player && !this.player.dead){
          this.tmpBoxA.setFromObject(this.player.mesh);
          this.tmpBoxB.setFromObject(b.mesh);
          if(this.tmpBoxA.intersectsBox(this.tmpBoxB)){
            // 被弾
            if(this.player.spawnInvul<=0){ this.playerDie(); this.player.spawnInvul=0.8; }
            b.dead = true; this.scene.remove(b.mesh); continue;
          }
        }
        // 地形やプラットフォームに当たったら消滅
        for(const e of this.entities){
          if(e===b || e.type==='enemy' || e.type==='bullet' || e.type==='player' || e.type==='checkpoint' || e.type==='goal') continue;
          this.tmpBoxA.setFromObject(e.mesh);
          this.tmpBoxB.setFromObject(b.mesh);
          if(this.tmpBoxA.intersectsBox(this.tmpBoxB)){
            b.dead = true; try{ this.scene.remove(b.mesh);}catch(e){}
            break;
          }
        }
      }
    }

    // 衝突(地面/プラットフォーム)
    p.onGround = false;
    this.tmpBoxA.setFromObject(p.mesh);
    for(const e of this.entities){
      if(e===p || e.dead) continue;
      if(e.type==='enemy' || e.type==='checkpoint' || e.type==='goal') continue;
      this.tmpBoxB.setFromObject(e.mesh);
      if(this.tmpBoxA.intersectsBox(this.tmpBoxB)){
        // 上からの着地判定
        const dy = (p.mesh.position.y - e.mesh.position.y);
        if(dy > 0){
          p.mesh.position.y = e.mesh.position.y + 1.6/2 + 0.8/2; // 高さ補正(プレイヤー高さ1.6, プラットフォーム0.8)
          p.vel.y = 0; p.onGround = true;
          this.tmpBoxA.setFromObject(p.mesh);
        }
      }
    }

    // 敵との当たり
    this.tmpBoxA.setFromObject(p.mesh);
    for(const e of this.entities){
      if(e.type!=='enemy' || e.dead) continue;
      this.tmpBoxB.setFromObject(e.mesh);
      if(this.tmpBoxA.intersectsBox(this.tmpBoxB)){
        // プレイヤーが上から踏んでいるか
        const pY = p.mesh.position.y;
        const eY = e.mesh.position.y;
        if(pY > eY + 0.2 && p.vel.y<0){
          // 踏みつけ
          e.dead = true;
          this.scene.remove(e.mesh);
          p.vel.y = CONFIG.jumpVelocity * 0.6; // バウンド
          this.score += e.scoreValue;
          this.playSE('stomp');
          this.spawnEnemyParticle(e.mesh.position,0xff5577);
        } else {
          // ダメージ
            if(p.spawnInvul<=0){
              this.playerDie();
              p.spawnInvul=0.8;
            }
            break;
        }
      }
    }

    // チェックポイント/ゴール
    for(const cp of this.checkpoints){
      if(!cp.activated && p.mesh.position.x >= cp.x){
        cp.activated = true;
        this.activateCheckpoint(cp.x);
      }
    }
    // ゴール判定
    if(p.mesh.position.x > this.stageLength + 2){
      this.clearedStageEl.textContent = `Stage ${this.stageIndex+1} Cleared!`;
  try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
  this.overlayCleared.classList.add('visible');
  this.playSE('clear');
    }

    // カメラ追従
    this.camera.position.x = clamp(p.mesh.position.x, 0, this.stageLength + 10);
  }

  animate(t){
    if(!this.lastTime) this.lastTime = t;
    const dt = Math.min(0.05,(t - this.lastTime)/1000);
    this.lastTime = t;
    if(!this.overlayStart.classList.contains('visible') && !this.overlayGameover.classList.contains('visible') && !this.overlayCleared.classList.contains('visible')){
      this.logic(dt);
    }
    this.renderer.render(this.scene,this.camera);
    requestAnimationFrame(this.animate);
  }

  getAxis(){
    const k = axis();
    let m = 0;
    if(this.mobileLeft) m-=1;
    if(this.mobileRight) m+=1;
    return Math.max(-1,Math.min(1,k+m));
  }

  // ワールド座標 -> 画面座標 (CSS px) 変換
  worldToScreen(vec){
    const rect = this.renderer.domElement.getBoundingClientRect();
    // カメラの左端 = camera.x - 16, 右端 = camera.x + 16
    const nx = (vec.x - (this.camera.position.x - 16)) / 32; // 0..1
    // カメラの上端 = camera.y + 9, 下端 = camera.y - 9
    const ny = ( (this.camera.position.y + 9) - vec.y ) / 18; // 0..1 (上0)
    return {
      x: nx * rect.width + rect.left,
      y: ny * rect.height + rect.top
    };
  }

  /* ===== パーティクル ===== */
  spawnEnemyParticle(pos,color){
    for(let i=0;i<8;i++) this.spawnParticle(pos,color);
  }
  spawnJumpParticle(pos){
    for(let i=0;i<4;i++) this.spawnParticle(pos,0x6dd5fa, {life:400,size:4});
  }
  spawnParticle(pos,color,opts={}){
    const el = document.createElement('div');
    el.className='particle';
    const c = new THREE.Color(color);
    el.style.background = `#${c.getHexString()}`;
    const a = Math.random()*Math.PI*2;
    const r = Math.random();
    const vx = Math.cos(a)*r*20; const vy = Math.sin(a)*r*14;
    el.style.setProperty('--x',vx+'px');
    el.style.setProperty('--y',vy+'px');
  const screen = this.worldToScreen(pos);
  el.style.left = screen.x + 'px';
  el.style.top = screen.y + 'px';
    const life = opts.life||600;
    const size = opts.size||6;
    el.style.width = size+'px'; el.style.height=size+'px';
    this.particleLayer.appendChild(el);
    setTimeout(()=>{el.remove();}, life);
  }

  /* ===== Audio ===== */
  initAudio(){
    if(!CONFIG.audio) return;
    const AudioContext = window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return;
    this.audioCtx = new AudioContext();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value=1; this.masterGain.connect(this.audioCtx.destination);
    this.bgmGain = this.audioCtx.createGain(); this.bgmGain.gain.value=CONFIG.bgmVolume; this.bgmGain.connect(this.masterGain);
    this.seGain = this.audioCtx.createGain(); this.seGain.gain.value=CONFIG.seVolume; this.seGain.connect(this.masterGain);
    this.generateSounds();
    this.audioReady=true;
  }
  resumeAudio(){
    if(this.audioCtx && this.audioCtx.state==='suspended') this.audioCtx.resume();
    // BGM 再生
    this.playBGM();
  }
  generateSounds(){
    // 極簡単な合成音 (jump, stomp, damage, clear)
    this.sounds.jump = ()=> this.simpleBeep(440,0.12,0.002,880);
    this.sounds.stomp = ()=> this.simpleNoise(0.18,300, 180);
    this.sounds.damage = ()=> this.simpleBeep(160,0.25,0.01,120);
    this.sounds.clear = ()=> this.simpleArp([523,659,784],0.35);
  this.sounds.checkpoint = ()=> this.simpleArp([392,523],0.3);
    this.sounds.shoot = ()=> this.simpleBeep(880,0.08,0.001,560);
    this.sounds.bgm = ()=> this.loopBgm();
  }
  
  // 弾の生成
  spawnBullet(fromPos, targetPos){
    const geo = new THREE.BoxGeometry(0.3,0.3,0.3);
    const mat = new THREE.MeshBasicMaterial({color:0xffff66});
    const m = new THREE.Mesh(geo, mat);
    m.position.set(fromPos.x, fromPos.y, 0);
    this.scene.add(m);
    const b = new Entity(m); b.type='bullet'; b.dead=false; b.life=4;
    // 速度: プレイヤー方向へノーマライズ
    const dir = new THREE.Vector3().subVectors(targetPos, fromPos).normalize();
    b.vel = dir.multiplyScalar(12);
    this.entities.push(b);
  }
  playSE(name){ if(!this.audioReady) return; const f=this.sounds[name]; if(f) f(); }
  playBGM(){ if(!this.audioReady) return; if(this.bgmPlaying) return; this.bgmPlaying=true; this.sounds.bgm(); }
  simpleBeep(freq,dur=0.2,attack=0.005,endFreq){
    const ctx=this.audioCtx; const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.type='sawtooth'; osc.frequency.value=freq; if(endFreq){osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime+dur);}
    gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(1, ctx.currentTime+attack); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    osc.connect(gain).connect(this.seGain); osc.start(); osc.stop(ctx.currentTime+dur);
  }
  simpleNoise(dur=0.2,start=400,end=120){
    const ctx=this.audioCtx; const buffer=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate); const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){data[i] = (Math.random()*2-1)*Math.pow(1-i/data.length,2);}
    const src=ctx.createBufferSource(); src.buffer=buffer; const biquad=ctx.createBiquadFilter(); biquad.type='lowpass'; biquad.frequency.value=start; biquad.frequency.linearRampToValueAtTime(end, ctx.currentTime+dur);
    const gain=ctx.createGain(); gain.gain.setValueAtTime(0.9,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    src.connect(biquad).connect(gain).connect(this.seGain); src.start();
  }
  simpleArp(notes,dur=0.6){
    const step=dur/notes.length; notes.forEach((n,i)=>{this.simpleBeep(n,step*0.9,0.005);});
  }
  loopBgm(){
    const ctx=this.audioCtx; const tempo=110; const beat=60/tempo; let t=ctx.currentTime; const root=261; // C4
    const pattern=[0,3,7,10, 0,5,7,12];
    const schedule=()=>{
      for(let i=0;i<pattern.length;i++){
        const freq=root*Math.pow(2, pattern[i]/12);
        const osc=ctx.createOscillator(); const gain=ctx.createGain();
        osc.type='triangle'; osc.frequency.value=freq;
        gain.gain.setValueAtTime(0, t+i*beat);
        gain.gain.linearRampToValueAtTime(0.6, t+i*beat+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t+i*beat+beat*0.9);
        osc.connect(gain).connect(this.bgmGain); osc.start(t+i*beat); osc.stop(t+i*beat+beat*0.9);
      }
      t += pattern.length*beat;
      if(this.bgmPlaying) setTimeout(schedule, pattern.length*beat*1000 - 50);
    };
    schedule();
  }
}
// 余分な閉じカッコ削除 (バグ修正)

const game = new Game();

// デバッグ: コンソールで game にアクセス可能
window.__ASURE__ = game;
// 外部呼び出し用 playsound API (要求仕様)
window.playsound = function(name){ game.playSE(name); };
