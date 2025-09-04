// 最小実装: Three.js Orthographic + シンプル物理 + UI連携 + WebAudio 簡易合成
(() => {
	const canvas = document.getElementById('c');
	const startBtn = document.getElementById('startBtn');
	const hud = document.getElementById('hud');
	const title = document.getElementById('title');
	const scoreEl = document.getElementById('score');
	const livesEl = document.getElementById('lives');
	const stageEl = document.getElementById('stage');
	const overlay = document.getElementById('overlay');

	let renderer = new THREE.WebGLRenderer({canvas, antialias:true});
	renderer.setPixelRatio(window.devicePixelRatio);
	let scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb);

	const aspect = window.innerWidth / window.innerHeight;
	const camW = 32, camH = 18;
	let camera = new THREE.OrthographicCamera(-camW/2, camW/2, camH/2, -camH/2, -100, 100);
	camera.position.set(0,5,10);
	camera.lookAt(0,0,0);

	window.addEventListener('resize', onResize);
	onResize();

	// Entities
	let player = null;
	let platforms = [];
	let enemies = [];
	let checkpoints = [];
	let stageIndex = 1;
	let score = 0;
	let lives = 3;

	// Input
	const keys = {left:false,right:false,jump:false};
	const touch = {left:false,right:false,jump:false};
	bindInputs();

	// Audio
	const AudioCtx = window.AudioContext || window.webkitAudioContext;
	const audioCtx = AudioCtx ? new AudioCtx() : null;
	window.playsound = (name='') => { playSE(name); };

	function playSE(name){
		if(!audioCtx) return;
		const t = audioCtx.currentTime;
		const o = audioCtx.createOscillator();
		const g = audioCtx.createGain();
		o.connect(g); g.connect(audioCtx.destination);
		switch(name){
			case 'jump': o.type='sine'; o.frequency.setValueAtTime(880,t); g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25); break;
			case 'stomp': o.type='square'; o.frequency.setValueAtTime(220,t); g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12); break;
			case 'damage': o.type='sawtooth'; o.frequency.setValueAtTime(140,t); g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); break;
			case 'clear': o.type='triangle'; o.frequency.setValueAtTime(660,t); g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.6); break;
			case 'checkpoint': o.type='sine'; o.frequency.setValueAtTime(1320,t); g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); break;
			default: o.type='sine'; o.frequency.setValueAtTime(440,t); g.gain.setValueAtTime(0.04,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12); break;
		}
		o.start(t); o.stop(t+0.5);
	}

	startBtn.addEventListener('click', ()=> startGame());

	function startGame(){
		title.classList.add('hidden');
		hud.classList.remove('hidden');
		stageIndex = 1; score = 0; lives = 3;
		loadStage(stageIndex);
		animate();
	}

	function loadStage(n){
		// clear
		while(scene.children.length) scene.remove(scene.children[0]);
		platforms = []; enemies = []; checkpoints = [];
		// basic light
		const ambient = new THREE.AmbientLight(0xffffff,0.8); scene.add(ambient);
		// ground
		const groundGeom = new THREE.BoxGeometry(200,1,4);
		const groundMat = new THREE.MeshStandardMaterial({color:0x3a8b3a});
		const ground = new THREE.Mesh(groundGeom,groundMat);
		ground.position.set(50,-5,0);
		scene.add(ground);
		platforms.push(ground);

		// player
		const pGeom = new THREE.BoxGeometry(1,1.6,1);
		const pMat = new THREE.MeshStandardMaterial({color:0xffcc00});
		player = { mesh: new THREE.Mesh(pGeom,pMat), vel:new THREE.Vector3(), onGround:false, prevY:0 };
		player.mesh.position.set(0,0,0.5);
		scene.add(player.mesh);

		// generate platforms and enemies
		for(let i=0;i<6;i++){
			const w = 4 + Math.random()*6;
			const ph = -3 + Math.floor(Math.random()*6);
			const px = 10 + i*14 + (Math.random()*6 - 3);
			const g = new THREE.Mesh(new THREE.BoxGeometry(w,0.8,2), new THREE.MeshStandardMaterial({color:0x7b5f3b}));
			g.position.set(px,ph,0);
			scene.add(g);
			platforms.push(g);
			// spawn enemy on some platforms
			if(Math.random()>0.4){
				const e = spawnEnemy(px, ph + 1);
				enemies.push(e);
			}
		}

		// checkpoints (3)
		for(let i=0;i<3;i++){
			const cp = new THREE.Mesh(new THREE.BoxGeometry(0.6,1.6,0.5), new THREE.MeshStandardMaterial({color:0x00aaff}));
			cp.position.set(20 + i*25, -2 + i, 0.6);
			scene.add(cp); checkpoints.push(cp);
		}

		updateHUD();
	}

	function spawnEnemy(x,y){
		const geo = new THREE.BoxGeometry(1,1,1);
		const mat = new THREE.MeshStandardMaterial({color:0xff4444});
		const m = new THREE.Mesh(geo, mat);
		m.position.set(x,y,0.6);
		m.userData = { alive:true, vx: (Math.random()>0.5? 0.8:-0.8) };
		scene.add(m);
		return m;
	}

	function updateHUD(){
		scoreEl.textContent = 'SCORE: ' + score;
		livesEl.textContent = '❤'.repeat(lives) + (lives<=0 ? ' (0)' : '');
		stageEl.textContent = 'STAGE ' + stageIndex;
	}

	// simple AABB helper
	function boxOf(obj){
		const b = new THREE.Box3().setFromObject(obj);
		return b;
	}

	let last = performance.now();
	function animate(t){
		const now = performance.now();
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		step(dt);
		renderer.render(scene, camera);
		if(lives>0 && stageIndex<=5) requestAnimationFrame(animate);
	}

	function step(dt){
		// camera follow
		camera.position.x = player.mesh.position.x + 6;
		camera.updateProjectionMatrix();

		// input
		let ax = 0;
		if(keys.left || touch.left) ax -= 1;
		if(keys.right || touch.right) ax += 1;
		player.vel.x = ax * 8;

		// apply gravity
		player.prevY = player.mesh.position.y;
		player.vel.y -= 40 * dt;
		player.mesh.position.x += player.vel.x * dt;
		player.mesh.position.y += player.vel.y * dt;

		// platforms collision
		player.onGround = false;
		for(const p of platforms){
			const pb = boxOf(p);
			const pl = boxOf(player.mesh);
			if(pl.intersectsBox(pb)){
				// simple from-top correction
				const top = pb.max.y;
				if(player.prevY >= top){
					player.mesh.position.y = top + 0.8; // half player height
					player.vel.y = 0;
					player.onGround = true;
				} else {
					// side collision correction (very simple)
					if(player.mesh.position.x < pb.min.x) player.mesh.position.x = pb.min.x - 1;
					if(player.mesh.position.x > pb.max.x) player.mesh.position.x = pb.max.x + 1;
				}
			}
		}

		// jump command
		if((keys.jump || touch.jump) && player.onGround){
			player.vel.y = 13;
			player.onGround = false;
			playSE('jump');
		}

		// enemies movement & stomp check
		for(let i = enemies.length-1; i>=0; i--){
			const e = enemies[i];
			if(!e.userData.alive) continue;
			e.position.x += e.userData.vx * dt * 4;
			// simple patrol bounds
			if(Math.abs(e.position.x - camera.position.x) > 80) e.userData.vx *= -1;

			const eb = boxOf(e);
			const pb = boxOf(player.mesh);
			if(pb.intersectsBox(eb)){
				// stomp if player descending and above enemy
				if(player.prevY > eb.max.y + 0.1 && player.vel.y < 0){
					// defeat
					e.userData.alive = false;
					scene.remove(e);
					enemies.splice(i,1);
					score += Math.floor(150 * (1 + stageIndex*0.1));
					player.vel.y = 8; // small bounce
					playSE('stomp');
					updateHUD();
				} else {
					// take damage
					hitPlayer();
				}
			}
		}

		// checkpoints
		for(const cp of checkpoints){
			const cb = boxOf(cp);
			const pb = boxOf(player.mesh);
			if(pb.intersectsBox(cb)){
				// heal and mark checkpoint (one-time visual)
				playSE('checkpoint');
				lives = 3;
				updateHUD();
				cp.material.color.set(0x00ff88);
			}
		}

		// goal: if player.x beyond some value per stage
		if(player.mesh.position.x > 90 + (stageIndex-1)*40){
			playSE('clear');
			stageIndex++;
			if(stageIndex>5){
				overlay.textContent = 'ALL STAGES CLEARED';
				overlay.classList.remove('hidden');
				setTimeout(()=>{ location.reload(); }, 2500);
			} else {
				overlay.textContent = 'STAGE CLEARED';
				overlay.classList.remove('hidden');
				setTimeout(()=>{ overlay.classList.add('hidden'); loadStage(stageIndex); }, 1200);
			}
		}

		// death fall
		if(player.mesh.position.y < -30){
			hitPlayer(true);
		}
	}

	function hitPlayer(respawn=false){
		playSE('damage');
		lives--;
		if(lives<=0){
			gameOver();
			return;
		}
		// respawn at current camera x - 6
		player.mesh.position.set(camera.position.x - 6, 5, 0.5);
		player.vel.set(0,0,0);
		updateHUD();
	}

	function gameOver(){
		overlay.textContent = 'GAME OVER';
		overlay.classList.remove('hidden');
		hud.classList.add('hidden');
		setTimeout(()=>{ location.reload(); }, 2000);
	}

	// input bindings
	function bindInputs(){
		window.addEventListener('keydown', (e)=>{
			if(e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = true;
			if(e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = true;
			if(['ArrowUp','w','W',' '].includes(e.key)) keys.jump = true;
		});
		window.addEventListener('keyup', (e)=>{
			if(e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = false;
			if(e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = false;
			if(['ArrowUp','w','W',' '].includes(e.key)) keys.jump = false;
		});
		// touch controls
		const leftBtn = document.getElementById('leftBtn');
		const rightBtn = document.getElementById('rightBtn');
		const jumpBtn = document.getElementById('jumpBtn');
		function setTouch(btn,flag){
			if(!btn) return;
			btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); touch[flag] = true; });
			btn.addEventListener('touchend', (e)=>{ e.preventDefault(); touch[flag] = false; });
			btn.addEventListener('mousedown', ()=> touch[flag]=true);
			btn.addEventListener('mouseup', ()=> touch[flag]=false);
		}
		setTouch(leftBtn,'left'); setTouch(rightBtn,'right'); setTouch(jumpBtn,'jump');
	}

	function onResize(){
		const w = window.innerWidth, h = window.innerHeight;
		renderer.setSize(w,h);
		const camW = 32;
		const camH = camW * (h/w) * 0.56; // keep approximate proportions; will be adjusted by camera projection
		camera.left = -camW/2; camera.right = camW/2;
		camera.top = camH/2; camera.bottom = -camH/2;
		camera.updateProjectionMatrix();
	}

	// initialize a minimal scene so start shows expected state
	loadStage(1);

	// Expose some for debugging
	window.__asure__ = { scene, camera, player };
})();
