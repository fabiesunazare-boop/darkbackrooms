// DARK BACKROOMS - ENGINE DE JOGO COMPLETO
let camera, scene, renderer, controls;
let clock = new THREE.Clock();

const gridSize = 25;
const cellSize = 12;
const wallHeight = 15;
let map = [];
let walls = [];
let mazeObjects = [];

let gunMesh, muzzleFlashLight, pistolMountedLight, pistolLightTarget, pistolLightBeam;
let maxAmmo = 15;
let ammo = maxAmmo;
let weaponType = 'pistol';
let weaponDamage = 1;
let fireCooldown = 0;
let spawnTimer = null;
let isReloading = false;
let isIntroPlaying = false;
let isGameRunning = false;
let playerHealth = 100;
let gunRecoilTimer = 0;
let playerSlowTimer = 0;
let playerAcidBurnTimer = 0;

let monsters = [];
let bloodParticles = [];
let floorBloodDecals = [];
let wallBloodDecals = [];
let acidProjectiles = [];
let shockwaveRings = [];
let currentMonsterIndex = 0;
let currentMonsterAlive = false;
let kills = 0;
let targetKills = 4;
let currentPhase = 1;
let phaseTransitioning = false;
let mazeTheme = 'red';
let worldMoon = null, worldStars = null, worldSky = null;
let healthPickups = [];

// CONTROLES WASD
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isSprinting = false;
const basePlayerSpeed = 17.0;
const sprintMultiplier = 1.75;
const PLAYER_RADIUS = 1.65;
const MONSTER_RADIUS = 2.0;
const PATH_RECALC_TIME = 0.35;

// ÁUDIO NATIVO
let audioCtx = null, ambientGain = null, audioReady = false;
let gameMusic = null;

// ELEMENTOS DE INTERFACE
const uiAmmo = document.getElementById('ammoCount');
const uiKills = document.getElementById('killCount');
const uiHealth = document.getElementById('healthCount');
const uiReload = document.getElementById('reloadWarning');
const damageOverlay = document.getElementById('damageOverlay');
const bloodSplatterOverlay = document.getElementById('bloodSplatterOverlay');
const blindnessOverlay = document.getElementById('blindnessOverlay');
const acidOverlay = document.getElementById('acidOverlay');
const shockwaveOverlay = document.getElementById('shockwaveOverlay');
const abilityBanner = document.getElementById('abilityBanner');
const startPrompt = document.getElementById('startPrompt');
const levelPromptText = document.getElementById('levelPromptText');
const hpContainer = document.getElementById('monsterHealthContainer');
const radarHud = document.getElementById('radarHud');
const radarText = document.getElementById('radarText');
const radarArrow = document.getElementById('radarArrow');

function createIntroStars() {
    const layer = document.getElementById('introStars');
    if (!layer) return;
    for(let i = 0; i < 90; i++) {
        const s = document.createElement('span');
        s.className = 'intro-star';
        s.style.left = (Math.random() * 100) + '%';
        s.style.top = (Math.random() * 70) + '%';
        s.style.opacity = (.25 + Math.random() * .75).toFixed(2);
        s.style.animationDelay = (Math.random() * 3) + 's';
        layer.appendChild(s);
    }
}

function triggerIntroLightning() {
    const el = document.getElementById('introLightning');
    if (!el) return;
    el.classList.remove('lightningFlash');
    void el.offsetWidth;
    el.classList.add('lightningFlash');
    setTimeout(triggerIntroLightning, 2500 + Math.random() * 4500);
}

// SEQUÊNCIA DE ABERTURA CORRIGIDA:
// 1. "Powered by" aparece no fundo preto.
// 2. "Powered by" desvanece e entra a foto AURAIO.
// 3. AURAIO desvanece e entra o menu DARK BACKROOMS (Powered by NUNCA mais aparece!).
function playOpeningSequence() {
    const boot = document.getElementById('bootScreen');
    const powered = document.getElementById('poweredBy');
    const auraio = document.getElementById('auraioIntro');
    const menu = document.getElementById('introScreen');

    powered.style.opacity = '1';

    setTimeout(() => {
        powered.style.transition = 'opacity 0.8s ease';
        powered.style.opacity = '0';
        setTimeout(() => {
            powered.style.display = 'none'; // REMOVE COMPLETAMENTE para nunca reaparecer
            auraio.style.opacity = '1';
        }, 800);
    }, 1600);

    setTimeout(() => {
        auraio.style.opacity = '0';
        setTimeout(() => {
            boot.style.opacity = '0';
            menu.classList.remove('menuHidden');
            menu.classList.add('menuVisible');
            menu.style.pointerEvents = 'auto';
            setTimeout(() => {
                boot.style.display = 'none';
                document.getElementById('title').style.opacity = '1';
                document.getElementById('playBtn').style.opacity = '1';
                try { startGameMusic(); } catch(e) {}
            }, 1000);
        }, 900);
    }, 4800);
}

window.onload = function() {
    createIntroStars();
    setTimeout(triggerIntroLightning, 900);
    init();
    animate();
    playOpeningSequence();
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020000);
    scene.fog = new THREE.FogExp2(0x05070d, 0.010);
    createOpenNightEnvironment();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    controls = new THREE.PointerLockControls(camera, document.body);
    controls.pointerSpeed = 0.55;
    scene.add(new THREE.AmbientLight(0x442222));
    
    const flashLight = new THREE.PointLight(0xffffff, 0.8, 30);
    camera.add(flashLight);
    scene.add(camera);
    
    generateMaze(createWallTexture('red'), createBloodTexture('skull'), createBloodTexture('devil'));
    createPlayerSpawn();
    createRealisticGun();
    initAudio();
    initBestiary();

    document.getElementById('playBtn').addEventListener('click', startCinematic);
    document.getElementById('nextPhaseBtn').addEventListener('click', startNextPhase);
    startPrompt.addEventListener('click', startGameplay);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('blur', () => { moveForward = moveBackward = moveLeft = moveRight = false; isSprinting = false; });
    
    controls.addEventListener('lock', function () { if(isGameRunning) toggleUI(true); });
    controls.addEventListener('unlock', function () { if(isGameRunning && playerHealth > 0) toggleUI(true); });
}

function toggleUI(show) {
    document.getElementById('hud').style.display = show ? 'block' : 'none';
    document.getElementById('playerHealthHud').style.display = show ? 'block' : 'none';
    document.getElementById('crosshair').style.display = show ? 'block' : 'none';
    document.getElementById('livesHud').style.display = show ? 'block' : 'none';
    document.getElementById('sprintHud').style.display = show ? 'block' : 'none';
    if (radarHud) radarHud.style.display = (show && currentMonsterAlive) ? 'flex' : 'none';
}

function initAudio() {
    gameMusic = document.getElementById('gameMusic');
    if (gameMusic) {
        gameMusic.volume = 0.28;
        gameMusic.loop = true;
    }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        ambientGain = audioCtx.createGain();
        ambientGain.gain.value = 0.035;
        ambientGain.connect(audioCtx.destination);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = 48; gain.gain.value = 0.018;
        osc.connect(gain).connect(ambientGain);
        osc.start();
        audioReady = true;
    } catch(e) { audioReady = false; }
}

function startGameMusic() {
    if (!gameMusic) return;
    try {
        gameMusic.volume = 0.28;
        const p = gameMusic.play();
        if (p && p.catch) p.catch(() => {});
    } catch(e) {}
}

function stopGameMusic() {
    if (!gameMusic) return;
    try { gameMusic.pause(); gameMusic.currentTime = 0; } catch(e) {}
}

function playSfx(type) {
    if (!audioReady || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const data = {
            shot: [110, 0.06, 'square', 0.12],
            hit: [60, 0.25, 'sawtooth', 0.25], // Som de impacto carnal bem mais visceral
            splatter: [45, 0.35, 'sawtooth', 0.28],
            roar: [95, 0.45, 'sawtooth', 0.18],
            pickup: [660, 0.16, 'sine', 0.08],
            thunder: [42, 0.55, 'sawtooth', 0.12]
        }[type] || [120, 0.08, 'sine', 0.05];
        osc.frequency.setValueAtTime(data[0], now);
        osc.type = data[2];
        gain.gain.setValueAtTime(data[3], now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + data[1]);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + data[1] + 0.02);
    } catch(e) {}
}

function createWallTexture(theme = 'red') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const yellow = theme === 'yellow';
    ctx.fillStyle = yellow ? '#c7a400' : '#4a0000';
    ctx.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 512; i += 32) {
        ctx.fillStyle = yellow ? '#806900' : '#2a0000';
        ctx.fillRect(i, 0, 16, 512);
    }
    for(let i = 0; i < 3500; i++) {
        ctx.fillStyle = yellow ? (Math.random() > 0.5 ? 'rgba(40,25,0,0.35)' : 'rgba(90,65,0,0.45)') : (Math.random() > 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(30,0,0,0.5)');
        ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 15, Math.random() * 25);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
}

function createBloodTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4a0000'; ctx.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 512; i += 32) { ctx.fillStyle = '#2a0000'; ctx.fillRect(i, 0, 16, 512); }
    ctx.strokeStyle = '#aa0000'; ctx.fillStyle = '#aa0000';
    ctx.lineWidth = 20; ctx.lineCap = 'round';
    if (type === 'devil') {
        ctx.beginPath(); ctx.arc(256, 256, 150, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(256, 406); ctx.lineTo(112, 148); ctx.lineTo(400, 148); ctx.closePath(); ctx.stroke();
    } else {
        ctx.beginPath(); ctx.arc(256, 200, 100, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(206, 280, 100, 80);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(216, 200, 30, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(296, 200, 30, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    return new THREE.CanvasTexture(canvas);
}

let rainPoints = null, rainPositions = null, lightningTimer = 0, lightningOverlay = null;
function createOpenNightEnvironment() {
    worldSky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.MeshBasicMaterial({ color: 0x02040a, side: THREE.BackSide }));
    scene.add(worldSky);

    worldMoon = new THREE.Mesh(new THREE.SphereGeometry(24, 32, 20), new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
    worldMoon.position.set(-170, 270, -260);
    scene.add(worldMoon);
    const moonGlow = new THREE.PointLight(0xdde7ff, 2.2, 520);
    moonGlow.position.copy(worldMoon.position);
    scene.add(moonGlow);

    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2, phi = Math.random() * Math.PI * 0.48, r = 560;
        starPos[i*3] = Math.cos(theta) * Math.sin(phi) * r;
        starPos[i*3+1] = Math.cos(phi) * r + 40;
        starPos[i*3+2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    worldStars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false }));
    scene.add(worldStars);

    const count = 1600;
    rainPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        rainPositions[i*3] = (Math.random() - .5) * 420;
        rainPositions[i*3+1] = Math.random() * 300 + 20;
        rainPositions[i*3+2] = (Math.random() - .5) * 420;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainPoints = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9db8d8, size: 0.9, transparent: true, opacity: 0.65 }));
    scene.add(rainPoints);

    lightningOverlay = document.createElement('div');
    lightningOverlay.style.cssText = 'position:fixed;inset:0;background:#dce8ff;opacity:0;pointer-events:none;z-index:40;mix-blend-mode:screen;';
    document.body.appendChild(lightningOverlay);
}

function updateWeather(delta) {
    if (!rainPoints) return;
    const pos = rainPoints.geometry.attributes.position.array;
    const px = camera.position.x, pz = camera.position.z;
    for (let i = 0; i < pos.length; i += 3) {
        pos[i+1] -= 190 * delta;
        if (pos[i+1] < 1) {
            pos[i] = px + (Math.random() - .5) * 420;
            pos[i+1] = 260 + Math.random() * 100;
            pos[i+2] = pz + (Math.random() - .5) * 420;
        }
    }
    rainPoints.geometry.attributes.position.needsUpdate = true;
    lightningTimer -= delta;
    if (lightningTimer <= 0) {
        lightningTimer = 6 + Math.random() * 9;
        if (lightningOverlay) {
            lightningOverlay.style.opacity = '0.8';
            setTimeout(() => lightningOverlay.style.opacity = '0.05', 70);
            setTimeout(() => lightningOverlay.style.opacity = '0.5', 120);
            setTimeout(() => lightningOverlay.style.opacity = '0', 200);
            playSfx('thunder');
        }
    }
}

// ============================================================
// PORTAS NAS PAREDES QUE NÃO LEVAM A LUGAR NENHUM
// Portas detalhadas com batentes, fechaduras enferrujadas e placas
// ============================================================
function createDoorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Madeira escura desgastada
    ctx.fillStyle = '#22140c';
    ctx.fillRect(0, 0, 256, 512);
    
    // Painéis entalhados da porta
    ctx.fillStyle = '#170c07';
    ctx.strokeStyle = '#3d2516';
    ctx.lineWidth = 6;
    
    // Painel superior
    ctx.strokeRect(24, 30, 208, 190);
    ctx.fillRect(28, 34, 200, 182);
    
    // Painel inferior
    ctx.strokeRect(24, 250, 208, 220);
    ctx.fillRect(28, 254, 200, 212);
    
    // Ranhuras de madeira
    for (let i = 0; i < 60; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(80,50,30,0.2)';
        ctx.fillRect(Math.random() * 256, Math.random() * 512, Math.random() * 4, Math.random() * 40 + 10);
    }
    
    // Marcas de arranhões macabros
    ctx.strokeStyle = 'rgba(80,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 180); ctx.lineTo(130, 230);
    ctx.moveTo(85, 175); ctx.lineTo(145, 235);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
}

const doorWoodTexture = createDoorTexture();

function createCorridorDoor(x, y, z, rotateY = 0) {
    const group = new THREE.Group();

    // Batente externo de metal/madeira grossa
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.2 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 6.2), frameMat);
    topFrame.position.set(0, 9.1, 0);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.2, 0.4), frameMat);
    postL.position.set(0, 4.5, -2.9);
    const postR = postL.clone();
    postR.position.z = 2.9;
    group.add(topFrame, postL, postR);

    // Folha da porta com textura de madeira entalhada
    const doorMat = new THREE.MeshStandardMaterial({
        map: doorWoodTexture,
        roughness: 0.85,
        metalness: 0.1
    });
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.8, 5.5), doorMat);
    doorLeaf.position.y = 4.45;
    group.add(doorLeaf);

    // Fechadura e Maçaneta de latão antigo
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb5943b, metalness: 0.85, roughness: 0.3 });
    const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.2, 0.4), brassMat);
    lockPlate.position.set(0, 4.4, 1.8);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), brassMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.18, 4.4, 1.95);
    group.add(lockPlate, handle);

    // Placa de metal "NÃO ENTRE" / "000" na porta
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 128; plateCanvas.height = 48;
    const pctx = plateCanvas.getContext('2d');
    pctx.fillStyle = '#6a0a0a'; pctx.fillRect(0, 0, 128, 48);
    pctx.strokeStyle = '#fff'; pctx.lineWidth = 3; pctx.strokeRect(4, 4, 120, 40);
    pctx.fillStyle = '#fff'; pctx.font = 'bold 20px monospace'; pctx.textAlign = 'center';
    pctx.fillText(Math.random() > 0.5 ? 'TRANCADA' : 'SALA 0' + Math.floor(Math.random()*9), 64, 31);
    const signTex = new THREE.CanvasTexture(plateCanvas);
    const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.55),
        new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    sign.position.set(0.16, 6.7, 0);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);

    group.position.set(x, y, z);
    group.rotation.y = rotateY;
    scene.add(group);
    mazeObjects.push(group);
}

function placeMazeDoors() {
    const candidates = [];
    for (let z = 1; z < gridSize - 1; z++) {
        for (let x = 1; x < gridSize - 1; x++) {
            if (map[z][x] !== 1) continue;
            if (isWalkableCell(z, x - 1)) candidates.push({ x, z, side: '-x' });
            if (isWalkableCell(z, x + 1)) candidates.push({ x, z, side: '+x' });
            if (isWalkableCell(z - 1, x)) candidates.push({ x, z, side: '-z' });
            if (isWalkableCell(z + 1, x)) candidates.push({ x, z, side: '+z' });
        }
    }

    candidates.sort(() => Math.random() - 0.5);
    const used = new Set();
    let count = 0;
    const maxDoors = currentPhase === 1 ? 14 : 20;

    for (const c of candidates) {
        const key = `${c.x},${c.z}`;
        if (used.has(key)) continue;

        const wx = c.x * cellSize;
        const wz = c.z * cellSize;

        if (c.side === '-x') {
            createCorridorDoor(wx - cellSize/2 - 0.16, 0, wz, Math.PI / 2);
        } else if (c.side === '+x') {
            createCorridorDoor(wx + cellSize/2 + 0.16, 0, wz, Math.PI / 2);
        } else if (c.side === '-z') {
            createCorridorDoor(wx, 0, wz - cellSize/2 - 0.16, 0);
        } else {
            createCorridorDoor(wx, 0, wz + cellSize/2 + 0.16, 0);
        }

        used.add(key);
        count++;
        if (count >= maxDoors) break;
    }
}

function generateMaze(baseTex, skullTex, devilTex) {
    mazeObjects.forEach(obj => scene.remove(obj));
    mazeObjects = []; walls = [];
    healthPickups.forEach(p => scene.remove(p.mesh));
    healthPickups = [];

    const wallMat = new THREE.MeshLambertMaterial({map:baseTex});
    const floorMat = new THREE.MeshLambertMaterial({ color: mazeTheme === 'yellow' ? 0x15130b : 0x111111 });

    map = Array.from({length:gridSize}, () => Array(gridSize).fill(1));
    const stack = [[1,1]]; map[1][1] = 0;
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
    while(stack.length) {
        const [z,x] = stack[stack.length-1];
        const choices = [];
        for(const [dz,dx] of dirs){
            const nz=z+dz, nx=x+dx;
            if(nz>0 && nz<gridSize-1 && nx>0 && nx<gridSize-1 && map[nz][nx]===1) choices.push([nz,nx,dz,dx]);
        }
        if(!choices.length){ stack.pop(); continue; }
        const [nz,nx,dz,dx] = choices[Math.floor(Math.random()*choices.length)];
        map[z+dz/2][x+dx/2] = 0; map[nz][nx] = 0;
        stack.push([nz,nx]);
    }

    const wallGeometry = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cellSize*gridSize, cellSize*gridSize), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set((gridSize*cellSize)/2-cellSize/2, 0, (gridSize*cellSize)/2-cellSize/2);
    scene.add(floor); mazeObjects.push(floor);

    for(let i=0; i<gridSize; i++) for(let j=0; j<gridSize; j++) {
        if(map[i][j] === 1) {
            const r = Math.random();
            let mat = wallMat;
            if(r > .94) mat = new THREE.MeshLambertMaterial({map:skullTex});
            else if(r > .89) mat = new THREE.MeshLambertMaterial({map:devilTex});
            const wall = new THREE.Mesh(wallGeometry, mat);
            wall.position.set(j*cellSize, wallHeight/2, i*cellSize);
            scene.add(wall); mazeObjects.push(wall); walls.push(wall);
        } else if(Math.random() > .89) {
            const light = new THREE.PointLight(mazeTheme==='yellow'?0xffc52e:0xff4422, .65, cellSize*3.2);
            light.position.set(j*cellSize, wallHeight-1, i*cellSize);
            scene.add(light); mazeObjects.push(light);
        }
    }
    
    placeMazeDoors();
    placeHealthPickups();
}

function isWalkableCell(gz, gx) {
    return gz>=1 && gz<gridSize-1 && gx>=1 && gx<gridSize-1 && map[gz] && map[gz][gx]===0;
}

function collidesWithWalls(x, z, radius = PLAYER_RADIUS) {
    const minX = Math.floor((x-radius)/cellSize)-1, maxX = Math.floor((x+radius)/cellSize)+1;
    const minZ = Math.floor((z-radius)/cellSize)-1, maxZ = Math.floor((z+radius)/cellSize)+1;
    for(let gz=minZ; gz<=maxZ; gz++) for(let gx=minX; gx<=maxX; gx++) {
        if(!map[gz] || map[gz][gx]!==1) continue;
        const cx=gx*cellSize, cz=gz*cellSize;
        const qx=Math.max(cx-cellSize/2, Math.min(x, cx+cellSize/2));
        const qz=Math.max(cz-cellSize/2, Math.min(z, cz+cellSize/2));
        const dx=x-qx, dz=z-qz;
        if(dx*dx+dz*dz < radius*radius) return true;
    }
    return false;
}

function moveEntityWithCollision(obj, dx, dz, radius = MONSTER_RADIUS) {
    const nx = obj.position.x + dx, nz = obj.position.z + dz;
    if(!collidesWithWalls(nx, obj.position.z, radius)) obj.position.x = nx;
    if(!collidesWithWalls(obj.position.x, nz, radius)) obj.position.z = nz;
    const min = cellSize + radius, max = (gridSize-2)*cellSize - radius;
    obj.position.x = Math.max(min, Math.min(max, obj.position.x));
    obj.position.z = Math.max(min, Math.min(max, obj.position.z));
}

function worldToCell(pos) { return { x: Math.round(pos.x/cellSize), z: Math.round(pos.z/cellSize) }; }

function findPath(startPos, goalPos) {
    const s = worldToCell(startPos), g = worldToCell(goalPos);
    if(!isWalkableCell(s.z, s.x) || !isWalkableCell(g.z, g.x)) return [];
    const key = (x,z) => x+','+z;
    const queue = [[s.x, s.z]], came = new Map(), seen = new Set([key(s.x, s.z)]);
    const dirs4 = [[1,0],[-1,0],[0,1],[0,-1]];
    for(let head=0; head<queue.length; head++) {
        const [x,z] = queue[head];
        if(x===g.x && z===g.z) break;
        for(const [dx,dz] of dirs4) {
            const nx=x+dx, nz=z+dz, k=key(nx,nz);
            if(!isWalkableCell(nz,nx) || seen.has(k)) continue;
            seen.add(k); came.set(k, [x,z]); queue.push([nx,nz]);
        }
    }
    const goal = key(g.x, g.z);
    if(!seen.has(goal)) return [];
    const path = []; let cur = [g.x, g.z];
    while(cur[0]!==s.x || cur[1]!==s.z) {
        path.push(cur); cur = came.get(key(cur[0], cur[1]));
        if(!cur) return [];
    }
    path.reverse(); return path;
}

function placeHealthPickups() {
    if(currentPhase < 2) {
        document.getElementById('lifePickupCount').textContent = '0';
        return;
    }
    const pc = worldToCell(controls.getObject().position), candidates = [];
    for(let z=1; z<gridSize-1; z++) for(let x=1; x<gridSize-1; x++) {
        if(!isWalkableCell(z,x)) continue;
        const d = Math.hypot((x-pc.x)*cellSize, (z-pc.z)*cellSize);
        if(d > 55) candidates.push({x,z,d});
    }
    candidates.sort((a,b) => b.d-a.d);
    const chosen = [];
    for(const c of candidates) {
        if(chosen.every(o => Math.hypot(c.x-o.x, c.z-o.z) >= 6)) {
            chosen.push(c); if(chosen.length >= 2) break;
        }
    }
    for(const c of chosen) {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({color:0xff3344});
        g.add(new THREE.Mesh(new THREE.BoxGeometry(.7,2.8,.7), mat));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(2.8,.7,.7), mat));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6,.12,8,24), new THREE.MeshBasicMaterial({color:0xff6677}));
        ring.rotation.x = Math.PI/2; g.add(ring);
        g.position.set(c.x*cellSize, 2, c.z*cellSize);
        scene.add(g); mazeObjects.push(g);
        healthPickups.push({mesh:g, used:false});
    }
    document.getElementById('lifePickupCount').textContent = String(healthPickups.length);
}

function updateHealthPickups(delta) {
    const p = controls.getObject().position;
    for(const h of healthPickups) {
        if(h.used) continue;
        h.mesh.rotation.y += delta * 1.2;
        h.mesh.position.y = 2 + Math.sin(clock.elapsedTime * 3) * .25;
        if(Math.hypot(p.x - h.mesh.position.x, p.z - h.mesh.position.z) < 3) {
            playerHealth = 100; uiHealth.textContent = '100'; h.used = true;
            scene.remove(h.mesh); playSfx('pickup');
            document.getElementById('lifePickupCount').textContent = String(healthPickups.filter(v => !v.used).length);
            damageOverlay.style.background = "radial-gradient(circle, transparent 45%, rgba(40,255,100,.5) 100%)";
            damageOverlay.style.opacity = '1'; setTimeout(() => damageOverlay.style.opacity = '0', 350);
        }
    }
}

function createPlayerSpawn() {
    let bestX = 1, bestZ = 1;
    let found = false;
    const mid = Math.floor(gridSize / 2);
    for (let dist = 0; dist < mid; dist++) {
        for (let dz = -dist; dz <= dist; dz++) {
            for (let dx = -dist; dx <= dist; dx++) {
                const x = mid + dx, z = mid + dz;
                if (isWalkableCell(z, x) && !collidesWithWalls(x * cellSize, z * cellSize, PLAYER_RADIUS + 0.6)) {
                    bestX = x; bestZ = z; found = true; break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }
    camera.position.set(bestX * cellSize, 6, bestZ * cellSize);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
}

function createRealisticGun() {
    if (gunMesh) camera.remove(gunMesh);
    weaponType = 'pistol';
    maxAmmo = 15;
    weaponDamage = 1;
    ammo = maxAmmo;

    const gunGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.1, roughness: 0.9 });

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 2.5), metalMat);
    slide.position.set(0, 0, -1);
    gunGroup.add(slide);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.5), gripMat);
    grip.position.set(0, -0.6, -0.1);
    grip.rotation.x = Math.PI / 10;
    gunGroup.add(grip);

    const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.1), metalMat);
    sightFront.position.set(0, 0.2, -2.1);
    gunGroup.add(sightFront);

    muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 20);
    muzzleFlashLight.position.set(0, 0, -2.5);
    gunGroup.add(muzzleFlashLight);

    // LANTERNA TÁTICA MONTADA NA PISTOLA
    const lightBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.20, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 0.75, roughness: 0.28 })
    );
    lightBody.position.set(0, 0.30, -0.72);
    gunGroup.add(lightBody);

    const lightLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 })
    );
    lightLens.rotation.x = Math.PI / 2;
    lightLens.position.set(0, 0.30, -1.045);
    gunGroup.add(lightLens);

    pistolMountedLight = new THREE.SpotLight(0xffffff, 9.0, 72, Math.PI / 7, 0.48, 1.35);
    pistolMountedLight.position.set(0, 0.30, -1.05);

    pistolLightTarget = new THREE.Object3D();
    pistolLightTarget.position.set(0, 0.05, -34);
    gunGroup.add(pistolLightTarget);
    pistolMountedLight.target = pistolLightTarget;
    gunGroup.add(pistolMountedLight);

    gunGroup.position.set(0.6, -0.5, -1.2);
    camera.add(gunGroup);
    scene.add(camera);
    gunMesh = gunGroup;
    uiAmmo.innerText = ammo;
}

function setWeapon(type) {
    if (type === 'pistol') {
        createRealisticGun();
        return;
    }
    weaponType = type;
    if (type === 'shotgun') { maxAmmo = 8; weaponDamage = 2; }
    if (type === 'machinegun') { maxAmmo = 40; weaponDamage = 2; }
    ammo = maxAmmo;
    if (gunMesh) camera.remove(gunMesh);
    
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({color:0x252525, metalness:.85, roughness:.22});
    const dark = new THREE.MeshStandardMaterial({color:0x111111, metalness:.15, roughness:.8});
    if (type === 'shotgun') {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,3.8,12), metal);
        barrel.rotation.x = Math.PI/2; barrel.position.z = -1.8; g.add(barrel);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(.48,.5,1.6), dark); stock.position.z = .25; g.add(stock);
        const pump = new THREE.Mesh(new THREE.BoxGeometry(.62,.42,.9), dark); pump.position.set(0,-.05,-1.25); g.add(pump);
    } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(.42,.5,2.7), metal); body.position.z = -.8; g.add(body);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,2.1,10), metal); barrel.rotation.x = Math.PI/2; barrel.position.z = -2.3; g.add(barrel);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(.32,.8,.55), dark); mag.position.set(0,-.55,-.55); mag.rotation.x = -.25; g.add(mag);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(.3,.35,1.1), dark); stock.position.z = .85; g.add(stock);
    }
    muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 20); muzzleFlashLight.position.set(0, 0, -2.5); g.add(muzzleFlashLight);

    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 12), metal);
    torch.rotation.x = Math.PI/2; torch.position.set(0, 0.35, -1.0); g.add(torch);
    const spot = new THREE.SpotLight(0xffffff, 8.0, 70, Math.PI/7, 0.45);
    spot.position.set(0, 0.35, -1.0);
    const sTarget = new THREE.Object3D(); sTarget.position.set(0, 0.1, -30); g.add(sTarget);
    spot.target = sTarget; g.add(spot);

    g.position.set(.6, -.5, -1.2);
    camera.add(g);
    scene.add(camera);
    gunMesh = g;
    uiAmmo.innerText = ammo;
}

// ============================================================
// VISUAL DOS MONSTROS MELHORADO EM 100%
// Geometrias ricas, chifres, dentes pontiagudos, olhos bioluminescentes,
// costelas expostas, garras articuladas e auras aterrorizantes!
// ============================================================

// 1. CEIFADOR FLUTUANTE (Crânio Demônio Gigante, Chifres, Costelas, Garras de Ossos e Olhos de Fogo)
function createFloatingSkull() {
    const g = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xede4d1, roughness: 0.65, metalness: 0.1 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1f1915, roughness: 0.8 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeFlameMat = new THREE.MeshBasicMaterial({ color: 0x33e5ff });

    // Crânio esculpido detalhado
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(3.2, 28, 20), boneMat);
    cranium.scale.set(1.0, 1.15, 1.05); cranium.position.y = 5.6; g.add(cranium);

    // Chifres curvos e pontiagudos
    for (const s of [-1, 1]) {
        const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.2, 10), hornMat);
        horn1.position.set(s * 2.2, 7.8, -0.2);
        horn1.rotation.set(-0.3, 0, s * -0.55);
        g.add(horn1);
    }

    // Órbitas oculares fundas com fogo espectral e luz interna
    for (const side of [-1.15, 1.15]) {
        const eyeSocket = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        eyeSocket.position.set(side, 5.65, -2.8); g.add(eyeSocket);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), eyeFlameMat);
        flame.position.set(side, 5.65, -2.9); g.add(flame);
    }
    const skullGlow = new THREE.PointLight(0x33e5ff, 2.8, 30);
    skullGlow.position.set(0, 5.6, -3.2); g.add(skullGlow);

    // Mandíbula escancarada com fileiras de dentes afiados
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.4, 2.6), boneMat);
    jaw.position.set(0, 3.2, -0.6); g.add(jaw);

    for (let i = -1.3; i <= 1.3; i += 0.45) {
        const toothU = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), toothMat);
        toothU.rotation.x = Math.PI; toothU.position.set(i, 4.3, -2.5); g.add(toothU);
        const toothD = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), toothMat);
        toothD.position.set(i, 3.6, -2.5); g.add(toothD);
    }

    // Coluna vertebral e costelas penduradas
    const spine = new THREE.Group();
    for (let c = 0; c < 5; c++) {
        const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8), boneMat);
        vert.position.y = 2.4 - c * 0.75; spine.add(vert);
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.6 - c * 0.22, 0.16, 6, 16, Math.PI), boneMat);
        rib.rotation.x = Math.PI / 2; rib.position.y = 2.4 - c * 0.75; spine.add(rib);
    }
    g.add(spine);

    // Braços esqueléticos com garras afiadas
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-2.8, 4.2, 0); armR.position.set(2.8, 4.2, 0);
    const armBone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 3.6, 8), boneMat);
    armBone.position.y = -1.8; armL.add(armBone); armR.add(armBone.clone());
    
    for (let f = -0.3; f <= 0.3; f += 0.3) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 6), hornMat);
        claw.position.set(f, -3.8, -0.4); claw.rotation.x = 0.5;
        armL.add(claw); armR.add(claw.clone());
    }
    g.add(armL, armR);

    g.userData.parts = { armL, armR, jaw, spine, glow: skullGlow };
    return g;
}

// 2. ARACNÍDEO DAS SOMBRAS (8 Pernas Articuladas, Ovos Pulsantes, Olhos Carmesins, Quelíceras com Veneno)
function createArachnidMonster() {
    const g = new THREE.Group();
    const chitinMat = new THREE.MeshStandardMaterial({ color: 0x120407, roughness: 0.3, metalness: 0.7 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x3d0710, roughness: 0.4 });
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

    // Abdômen gigantesco e bulboso com espinhos dorsais
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 16), chitinMat);
    abdomen.scale.set(1.1, 0.9, 1.8); abdomen.position.set(0, 2.6, 2.8); g.add(abdomen);
    for (let s = 0; s < 5; s++) {
        const dorsalSpike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 6), spikeMat);
        dorsalSpike.position.set(0, 3.6 + s*0.1, 1.8 + s*0.6);
        dorsalSpike.rotation.x = -0.4; g.add(dorsalSpike);
    }

    // Cefalotórax blindado
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), chitinMat);
    head.position.set(0, 2.3, -1.8); g.add(head);

    // 8 Olhos avermelhados agrupados
    const eyeCoords = [[-0.4, 2.7, -3.1], [0.4, 2.7, -3.1], [-0.8, 2.5, -2.9], [0.8, 2.5, -2.9],
                       [-0.3, 2.2, -3.2], [0.3, 2.2, -3.2], [-0.7, 2.1, -3.0], [0.7, 2.1, -3.0]];
    eyeCoords.forEach(pos => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), redEyeMat);
        eye.position.set(pos[0], pos[1], pos[2]); g.add(eye);
    });

    // Quelíceras curvas gigantescas
    const mandL = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.2, 8), spikeMat);
    mandL.position.set(-0.7, 1.4, -3.4); mandL.rotation.set(0.6, 0, 0.4);
    const mandR = mandL.clone();
    mandR.position.x = 0.7; mandR.rotation.z = -0.4;
    g.add(mandL, mandR);

    // 8 Pernas compridas totalmente articuladas
    const legs = [];
    for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 1.5, 2.3, -1.2 + row * 1.4);

        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.2, 8), chitinMat);
        upper.rotation.z = side * (Math.PI / 3); upper.position.set(side * 1.8, 1.4, 0);
        legGroup.add(upper);

        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.5, 8), chitinMat);
        lower.position.set(side * 3.6, -0.6, 0); lower.rotation.z = side * -(Math.PI / 4);
        legGroup.add(lower);

        g.add(legGroup);
        legs.push({ group: legGroup, side, row });
    }

    const spiderGlow = new THREE.PointLight(0xff1122, 2.2, 26);
    spiderGlow.position.set(0, 2.4, -2.5); g.add(spiderGlow);

    g.userData.parts = { legs, mandL, mandR, abdomen };
    return g;
}

// 3. TITÃ DE CARNE (Colosso de Músculos Costurados, Punho de Espinhos Sísmico, Tronco com Costelas Expostas)
function createBruteMonster() {
    const g = new THREE.Group();
    const muscleMat = new THREE.MeshStandardMaterial({ color: 0x5a0b0b, roughness: 0.75, metalness: 0.05 });
    const goreMat = new THREE.MeshStandardMaterial({ color: 0x820000, roughness: 0.4 });
    const boneArmorMat = new THREE.MeshStandardMaterial({ color: 0xd6cbb0, roughness: 0.6 });

    // Tronco maciço com suturas e musculatura monstruosa
    const chest = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.6, 4.0), muscleMat);
    chest.position.y = 6.4; g.add(chest);

    // Costelas e vísceras expostas na barriga
    const viscera = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 10), goreMat);
    viscera.position.set(0, 5.0, -1.6); g.add(viscera);
    for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(3.6 - r*0.4, 0.35, 0.4), boneArmorMat);
        rib.position.set(0, 6.2 - r*0.7, -2.05); g.add(rib);
    }

    // Ombreira gigante de osso farpado
    const pauldron = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.4, 8), boneArmorMat);
    pauldron.position.set(3.4, 8.8, 0); pauldron.rotation.z = -0.7; g.add(pauldron);

    // Cabeça bestial com mandíbula de ferro
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 2.6), muscleMat);
    head.position.set(0, 9.4, -0.6); g.add(head);
    const redEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
    redEye1.position.set(-0.6, 9.6, -1.9); g.add(redEye1);
    const redEye2 = redEye1.clone(); redEye2.position.x = 0.6; g.add(redEye2);

    // Braço direito esmagador gigantesco com punho de espinhos
    const armRGroup = new THREE.Group();
    armRGroup.position.set(3.6, 7.8, 0);
    const bicepR = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 4.0, 10), muscleMat);
    bicepR.position.set(0.6, -2.0, 0); armRGroup.add(bicepR);
    const fistR = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 3.4), boneArmorMat);
    fistR.position.set(0.8, -5.2, 0); armRGroup.add(fistR);
    // Espinhos no punho
    for(let sp = 0; sp < 4; sp++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), boneArmorMat);
        spike.position.set(0.8 + (sp%2===0?-0.8:0.8), -5.2 + (sp>1?-0.8:0.8), -1.8);
        spike.rotation.x = -Math.PI / 2; armRGroup.add(spike);
    }
    g.add(armRGroup);

    // Braço esquerdo
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 4.8, 8), muscleMat);
    armL.position.set(-3.2, 6.2, 0); g.add(armL);

    // Pernas grossas de sustentação
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 4.2, 10), muscleMat);
    legL.position.set(-1.6, 2.1, 0);
    const legR = legL.clone(); legR.position.x = 1.6;
    g.add(legL, legR);

    const titanLight = new THREE.PointLight(0xff2200, 2.6, 32);
    titanLight.position.set(0, 7.0, -2.5); g.add(titanLight);

    g.userData.parts = { armRGroup, legL, legR };
    return g;
}

// 4. DEVORADOR ÁCIDO (Pústulas Fluorescentes, Mandíbula Deslocada com Baba Tóxica e Corcunda Radioativa)
function createAcidSpitterMonster() {
    const g = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x1f2e16, roughness: 0.8 });
    const acidMat = new THREE.MeshStandardMaterial({
        color: 0x39ff14, emissive: 0x2aff05, emissiveIntensity: 1.4, roughness: 0.2
    });

    // Corpo bípede encurvado
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 4.6, 12), skinMat);
    body.position.set(0, 4.2, 0); body.rotation.x = 0.35; g.add(body);

    // Enorme papo/saco gástrico translúcido e brilhante cheio de ácido verde
    const belly = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 16), acidMat);
    belly.position.set(0, 3.4, -1.2); g.add(belly);

    // Corcunda com bolhas/pústulas ácidas saltadas
    for (let p = 0; p < 7; p++) {
        const boil = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random()*0.3, 10, 8), acidMat);
        boil.position.set((Math.random()-0.5)*1.8, 5.4 + Math.random()*1.5, 0.8 + Math.random()*1.2);
        g.add(boil);
    }

    // Cabeça distorcida com mandíbula ácida escancarada
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 12), skinMat);
    head.position.set(0, 6.2, -1.6); g.add(head);

    const maw = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 2.2, 10, 1, true), skinMat);
    maw.position.set(0, 5.3, -2.4); maw.rotation.x = -0.5; g.add(maw);

    // Dentes de agulha
    for (let a = 0; a < 8; a++) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xddff88 }));
        fang.position.set(Math.cos(a)*0.9, 5.3 + Math.sin(a)*0.5, -2.5);
        g.add(fang);
    }

    // Luz ácida volumétrica esmeralda
    const acidLight = new THREE.PointLight(0x39ff14, 3.5, 34);
    acidLight.position.set(0, 4.0, -2.2); g.add(acidLight);

    g.userData.parts = { belly, acidLight };
    return g;
}

// 5. O OBSERVADOR (Olho Cósmico Ciclópico, Tentáculos de Nervo Óptico e Satélites Oculares Flutuantes)
function createWatcherMonster() {
    const g = new THREE.Group();
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x473820, roughness: 0.7 });
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4efdc, roughness: 0.3 });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0xeeff00 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Globo ocular central maciço
    const mainEye = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 20), scleraMat);
    mainEye.position.set(0, 5.4, 0); g.add(mainEye);

    // Íris e pupila de fenda ameaçadora
    const iris = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), irisMat);
    iris.position.set(0, 5.4, -2.62); g.add(iris);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 0.1), pupilMat);
    pupil.position.set(0, 5.4, -2.64); g.add(pupil);

    // Veias sangrentas no olho
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.25, 8, 24), fleshMat);
    ring.position.set(0, 5.4, 0); g.add(ring);

    // Tentáculos de nervos ópticos que serpenteiam abaixo do olho
    const tentacles = [];
    for (let t = 0; t < 7; t++) {
        const ang = (t / 7) * Math.PI * 2;
        const tent = new THREE.Group();
        for (let s = 0; s < 4; s++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.35 - s*0.06, 0.4 - s*0.06, 1.2, 8), fleshMat);
            seg.position.y = -s * 1.1; tent.add(seg);
        }
        tent.position.set(Math.cos(ang) * 1.6, 3.4, Math.sin(ang) * 1.6);
        g.add(tent);
        tentacles.push(tent);
    }

    // Olhos satélites menores flutuando em órbita
    const satellites = [];
    for (let st = 0; st < 3; st++) {
        const sat = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), scleraMat);
        const satIris = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), irisMat);
        satIris.position.set(0, 0, -0.66); sat.add(satIris);
        g.add(sat);
        satellites.push({ mesh: sat, angle: st * 2.1, dist: 4.2 });
    }

    const watcherGlow = new THREE.PointLight(0xeeff00, 3.0, 35);
    watcherGlow.position.set(0, 5.4, -3.2); g.add(watcherGlow);

    g.userData.parts = { tentacles, satellites, watcherGlow };
    return g;
}

// 6. O AÇOUGUEIRO (Carrasco com Cutelo Ensanguentado e Máscara de Ferro)
function createButcherMonster() {
    const g = new THREE.Group();
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x3d201a, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.9, roughness: 0.2 });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x8a0000, roughness: 0.3 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.4, 3.2), apronMat);
    torso.position.y = 5.8; g.add(torso);

    const cageHead = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 2.4), ironMat);
    cageHead.position.set(0, 9.0, 0); g.add(cageHead);
    const redEye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redEye.position.set(0, 9.1, -1.25); g.add(redEye);

    // Braço direito erguendo CUTELO GIGANTE
    const cleaverGroup = new THREE.Group();
    cleaverGroup.position.set(2.8, 7.2, 0);
    const cleaverBlade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.8, 1.8), ironMat);
    cleaverBlade.position.set(0.6, -1.8, -1.2);
    const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.4), bloodMat);
    bladeEdge.position.set(0.6, -1.8, -2.1);
    cleaverGroup.add(cleaverBlade, bladeEdge);
    g.add(cleaverGroup);

    const butcherLight = new THREE.PointLight(0xff2222, 2.4, 30);
    butcherLight.position.set(0, 7.0, -2.0); g.add(butcherLight);

    g.userData.parts = { cleaverGroup };
    return g;
}

// 7. CRIATURA DE COSTAS (Humanoide Contorcido com Coluna Invertida e Crânio Trincado)
function createBackwalkerMonster() {
    const g = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a7f78, roughness: 0.85 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xddd2bd, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 5.0, 10), skinMat);
    torso.position.set(0, 5.2, 0); torso.rotation.x = -0.3; g.add(torso);

    // Vértebras dorsais violentamente expostas
    for (let v = 0; v < 7; v++) {
        const vert = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), boneMat);
        vert.position.set(0, 3.4 + v * 0.6, 0.8 + v * 0.15);
        vert.rotation.x = 0.6; g.add(vert);
    }

    // Cabeça invertida de ponta-cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 12), skinMat);
    head.position.set(0, 8.0, 0.5); head.rotation.z = Math.PI; g.add(head);

    const paleGlow = new THREE.PointLight(0xd4be94, 2.0, 26);
    paleGlow.position.set(0, 6, 0); g.add(paleGlow);

    return g;
}

// 8. O DEVORADOR PÁLIDO (Humanoide Esguio com Garras de Agulha e Boca em Fenda) - FASE 2
function createPaleStalkerMonster() {
    const g = new THREE.Group();
    const paleMat = new THREE.MeshStandardMaterial({ color: 0xd6d0c2, roughness: 0.9, metalness: 0.05 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x050000 });

    // Tronco esguio, alto e desnutrido
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.7, 5.8, 10), paleMat);
    torso.position.y = 5.6; g.add(torso);

    // Costelas salientes e quebradas
    for (let r = 0; r < 5; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.2 - r*0.08, 0.12, 6, 12, Math.PI), paleMat);
        rib.rotation.x = Math.PI / 2; rib.position.set(0, 6.4 - r*0.75, -0.2); g.add(rib);
    }

    // Cabeça sem olhos, lisa com mandíbula vertical profunda
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 14), paleMat);
    head.scale.set(0.9, 1.3, 1.1); head.position.set(0, 9.2, -0.3); g.add(head);
    const maw = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 0.6), mouthMat);
    maw.position.set(0, 9.0, -1.35); g.add(maw);

    // Dentes de agulha finos na fenda
    for (let d = -0.6; d <= 0.6; d += 0.3) {
        const needle = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 4), clawMat);
        needle.rotation.x = Math.PI / 2; needle.position.set(0, 9.0 + d, -1.5); g.add(needle);
    }

    // Braços esguios longos que vão quase até o chão com garras pontiagudas de 1.2m
    const armL = new THREE.Group(); const armR = new THREE.Group();
    armL.position.set(-1.8, 7.4, 0); armR.position.set(1.8, 7.4, 0);
    const armBone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 5.4, 8), paleMat);
    armBone.position.y = -2.6; armL.add(armBone); armR.add(armBone.clone());

    for (let c = -0.3; c <= 0.3; c += 0.2) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.6, 6), clawMat);
        finger.position.set(c, -5.6, -0.3); finger.rotation.x = 0.4;
        armL.add(finger); armR.add(finger.clone());
    }
    g.add(armL, armR);

    // Pernas compridas desengonçadas
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 5.0, 8), paleMat);
    legL.position.set(-0.9, 2.5, 0); const legR = legL.clone(); legR.position.x = 0.9;
    g.add(legL, legR);

    const stalkerGlow = new THREE.PointLight(0x99ddff, 2.5, 30);
    stalkerGlow.position.set(0, 7.0, -1.8); g.add(stalkerGlow);

    g.userData.parts = { armL, armR };
    return g;
}

// 9. MÃE DAS LARVAS (Rainha Insetoide com Bolsas de Ovos Verdes Bioluminescentes e Foices) - FASE 3
function createBroodmotherMesh() {
    const g = new THREE.Group();
    const chitinMat = new THREE.MeshStandardMaterial({ color: 0x1b2812, roughness: 0.5, metalness: 0.4 });
    const eggSacMat = new THREE.MeshStandardMaterial({ color: 0x39ff14, emissive: 0x22cc0d, emissiveIntensity: 1.5, roughness: 0.2 });
    const scytheMat = new THREE.MeshStandardMaterial({ color: 0x0f180a, roughness: 0.2, metalness: 0.8 });

    // Abdômen gigantesco inchado cheio de casulos e ovos bioluminescentes
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 16), chitinMat);
    abdomen.scale.set(1.2, 1.1, 2.0); abdomen.position.set(0, 3.8, 3.2); g.add(abdomen);

    // Bolsas de ovos translúcidas e pulsantes
    const eggSacs = [];
    for (let b = 0; b < 9; b++) {
        const ang = (b / 9) * Math.PI * 2;
        const egg = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random()*0.4, 12, 10), eggSacMat);
        egg.position.set(Math.cos(ang) * 2.8, 3.8 + (Math.random()-0.5)*1.8, 2.8 + Math.sin(ang) * 2.2);
        g.add(egg);
        eggSacs.push(egg);
    }

    // Tórax blindado e cabeça com mandíbulas afiadas
    const thorax = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.4, 3.2), chitinMat);
    thorax.position.set(0, 5.8, -0.6); g.add(thorax);

    const head = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.8, 8), chitinMat);
    head.position.set(0, 6.2, -2.6); head.rotation.x = -Math.PI / 2; g.add(head);

    // Olhos compostos verdes
    for (const s of [-0.9, 0.9]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0x88ff00 }));
        eye.position.set(s, 6.8, -3.2); g.add(eye);
    }

    // Foices frontais serrilhadas de louva-a-deus
    const scytheL = new THREE.Group(); const scytheR = new THREE.Group();
    scytheL.position.set(-2.4, 6.8, -1.2); scytheR.position.set(2.4, 6.8, -1.2);
    const bladeGeo = new THREE.BoxGeometry(0.3, 4.2, 0.9);
    const bladeL = new THREE.Mesh(bladeGeo, scytheMat);
    bladeL.position.set(0, -1.8, -1.6); bladeL.rotation.x = 0.5; scytheL.add(bladeL);
    const bladeR = bladeL.clone(); scytheR.add(bladeR);
    g.add(scytheL, scytheR);

    // 6 Patas insetoides
    const legs = [];
    for (let p = 0; p < 6; p++) {
        const s = p % 2 === 0 ? -1 : 1;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4.8, 8), chitinMat);
        leg.position.set(s * 2.8, 2.2, (Math.floor(p/2) - 1) * 2.2);
        leg.rotation.z = s * 0.6; g.add(leg);
        legs.push(leg);
    }

    const broodLight = new THREE.PointLight(0x39ff14, 3.5, 36);
    broodLight.position.set(0, 5.0, 1.0); g.add(broodLight);

    g.userData.parts = { eggSacs, scytheL, scytheR, legs };
    return g;
}

// 10. O RASGADOR (Predador Biomecânico de Lâminas Negras de 2.5 Metros e Crista Farpada) - FASE 3
function createRipperMesh() {
    const g = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.25, metalness: 0.9 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1f0308, roughness: 0.15, metalness: 0.95 });
    const crimsonCoreMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    // Tronco blindado afunilado
    const torso = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6.0, 8), armorMat);
    torso.position.y = 5.2; torso.rotation.x = Math.PI; g.add(torso);

    // Crista farpada nas costas
    for (let sp = 0; sp < 6; sp++) {
        const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.2, 6), bladeMat);
        dorsal.position.set(0, 4.0 + sp*0.8, 1.4); dorsal.rotation.x = -0.7; g.add(dorsal);
    }

    // Cabeça aerodinâmica com visor em fendas carmesins
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.0, 6), armorMat);
    head.position.set(0, 8.4, -0.6); head.rotation.x = -Math.PI / 2.2; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.4), crimsonCoreMat);
    visor.position.set(0, 8.5, -2.1); g.add(visor);

    // Lâminas de 2.8m nos dois braços
    const bladeArmL = new THREE.Group(); const bladeArmR = new THREE.Group();
    bladeArmL.position.set(-2.6, 6.8, 0); bladeArmR.position.set(2.6, 6.8, 0);
    const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.8, 8), armorMat);
    armBase.position.y = -1.2; bladeArmL.add(armBase); bladeArmR.add(armBase.clone());

    const giantBladeGeo = new THREE.BoxGeometry(0.2, 5.2, 1.2);
    const gBladeL = new THREE.Mesh(giantBladeGeo, bladeMat);
    gBladeL.position.set(0, -3.8, -1.4); gBladeL.rotation.x = 0.4; bladeArmL.add(gBladeL);
    const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 0.2), crimsonCoreMat);
    edgeL.position.set(0, -3.8, -2.0); bladeArmL.add(edgeL);

    const gBladeR = gBladeL.clone(); const edgeR = edgeL.clone();
    bladeArmR.add(gBladeR, edgeR);
    g.add(bladeArmL, bladeArmR);

    const ripperLight = new THREE.PointLight(0xff0044, 3.5, 36);
    ripperLight.position.set(0, 6.5, -2.0); g.add(ripperLight);

    g.userData.parts = { bladeArmL, bladeArmR };
    return g;
}

// 11. O COVEIRO (Espectro Colossal de Cartola, Pá de Ferro Ensanguentada e Lanterna Verde Sobrenatural) - FASE 3
function createGravediggerMesh() {
    const g = new THREE.Group();
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.95 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x242426, metalness: 0.8, roughness: 0.4 });
    const goreMat = new THREE.MeshStandardMaterial({ color: 0x660000, roughness: 0.5 });
    const lanternGlassMat = new THREE.MeshBasicMaterial({ color: 0x33ffaa });

    // Sobretudo longo esfarrapado e corpo de 5m
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 6.5, 12), coatMat);
    body.position.y = 4.2; g.add(body);

    // Cabeça com cartola gótica gasta
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    head.position.set(0, 8.4, 0); g.add(head);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 16), coatMat);
    hatBrim.position.set(0, 9.4, 0); g.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 2.6, 16), coatMat);
    hatTop.position.set(0, 10.7, 0); hatTop.rotation.z = -0.15; g.add(hatTop);

    // Olhos espectrais brancos no fundo da sombra
    for (const s of [-0.45, 0.45]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        eye.position.set(s, 8.4, -1.25); g.add(eye);
    }

    // Braço direito segurando PÁ GIGANTE DE COVEIRO com terra e sangue
    const shovelGroup = new THREE.Group();
    shovelGroup.position.set(2.4, 6.8, 0);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7.5, 8), ironMat);
    handle.position.set(0.6, -1.5, -0.6); handle.rotation.x = 0.35; shovelGroup.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 1.8), ironMat);
    blade.position.set(0.6, -4.8, -1.8); blade.rotation.x = 0.35; shovelGroup.add(blade);
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 1.4), goreMat);
    dirt.position.set(0.6, -5.2, -1.9); shovelGroup.add(dirt);
    g.add(shovelGroup);

    // Braço esquerdo segurando LANTERNA OSCILANTE COM FOGO VERDE
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(-2.4, 6.4, -1.2);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), ironMat);
    chain.position.y = -1.2; lanternGroup.add(chain);
    const lanternBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), lanternGlassMat);
    lanternBox.position.y = -2.6; lanternGroup.add(lanternBox);

    const ghostLight = new THREE.PointLight(0x33ffaa, 3.8, 38);
    ghostLight.position.set(0, -2.6, 0); lanternGroup.add(ghostLight);
    g.add(lanternGroup);

    g.userData.parts = { shovelGroup, lanternGroup };
    return g;
}

// 12. A NOIVA VAZIA (Espectro Flutuante com Véu Fúnebre em Farrapos, Coração Violeta e Lágrimas Espectrais) - FASE 3
function createHollowBrideMesh() {
    const g = new THREE.Group();
    const veilMat = new THREE.MeshStandardMaterial({
        color: 0x7a6c8a, transparent: true, opacity: 0.85, roughness: 0.9, side: THREE.DoubleSide
    });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd9d0df, roughness: 0.5 });
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xd000ff });

    // Vestido nupcial fúnebre flutuante em cone largo
    const dress = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7.2, 16, 1, true), veilMat);
    dress.position.y = 4.2; g.add(dress);

    // Caixa torácica esquelética exposta
    for (let c = 0; c < 5; c++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.4 - c*0.14, 0.12, 6, 16, Math.PI), boneMat);
        rib.rotation.x = Math.PI / 2; rib.position.set(0, 6.8 - c*0.65, -0.1); g.add(rib);
    }

    // Coração violeta pulsante dentro das costelas
    const soulHeart = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), heartMat);
    soulHeart.scale.set(0.9, 1.2, 0.8); soulHeart.position.set(0, 5.6, -0.2); g.add(soulHeart);

    // Crânio envolto por véu rasgado
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 12), boneMat);
    skull.position.set(0, 8.6, 0); g.add(skull);
    const veil = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI*2, 0, Math.PI/1.5), veilMat);
    veil.position.set(0, 8.8, 0); g.add(veil);

    // Coroa de espinhos negros
    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.14, 6, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    crown.rotation.x = Math.PI / 2; crown.position.set(0, 9.6, 0); g.add(crown);

    // Lágrimas violetas brilhantes
    for (const s of [-0.42, 0.42]) {
        const tear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.02, 1.4, 6), heartMat);
        tear.position.set(s, 7.8, -1.3); g.add(tear);
    }

    // Braços esqueléticos abertos
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 4.2, 8), boneMat);
    armL.position.set(-2.4, 6.6, 0); armL.rotation.z = 0.8;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 4.2, 8), boneMat);
    armR.position.set(2.4, 6.6, 0); armR.rotation.z = -0.8;
    g.add(armL, armR);

    const brideLight = new THREE.PointLight(0xd000ff, 4.0, 38);
    brideLight.position.set(0, 6.0, -1.8); g.add(brideLight);

    g.userData.parts = { soulHeart, dress };
    return g;
}

// PERFIS COMPLETOS DE TODAS AS 12 ENTIDADES EXCLUSIVAS (SEM REPETIÇÕES!)
const MONSTER_PROFILES = {
    skull: { name: 'CEIFADOR FLUTUANTE', badge: 'Classe: Espectral', icon: '☠️', createMesh: createFloatingSkull, baseHealth: 4, baseSpeed: 20, color: '#33e5ff', cooldown: 8.5, appearance: 'Crânio colossal demoníaco de chifres escuros, órbitas incandescentes com fogo azul e garras de osso.', colorDesc: 'Marfim, ônix e fogo azul celeste.', size: '4.8m', texture: 'Osso seco calcificado.', features: 'Grito paralisante.', abilityName: 'GRITO ENSURDECEDOR', abilityDesc: 'Emite onda sônica paralisante.', lore: 'Paira faminto pelos corredores eternos.' },
    arachnid: { name: 'ARACNÍDEO DAS SOMBRAS', badge: 'Classe: Quimérica', icon: '🕷️', createMesh: createArachnidMonster, baseHealth: 5, baseSpeed: 23, color: '#ff2233', cooldown: 7.0, appearance: 'Predador aracnídeo de carapaça espinhada, 8 pernas afiadas, quelíceras venenosas e múltiplos olhos carmesins.', colorDesc: 'Preto obsidiana e vermelho carmesim.', size: '3.6m', texture: 'Quitina blindada espinhosa.', features: 'Salto mortal rápido.', abilityName: 'INVESTIDA DAS TREVAS', abilityDesc: 'Bote acrobático violento.', lore: 'Embosca exploradores nos cantos escuros.' },
    spitter: { name: 'DEVORADOR ÁCIDO', badge: 'Classe: Químico', icon: '🧪', createMesh: createAcidSpitterMonster, baseHealth: 5, baseSpeed: 17, color: '#39ff14', cooldown: 6.5, appearance: 'Monstruosidade bípede corcunda com saco gástrico fluorescente pulsando ácido verde e mandíbula corrosiva.', colorDesc: 'Verde radioativo e carne necrosada.', size: '3.4m', texture: 'Pústulas ácidas translúcidas.', features: 'Projéteis cáusticos.', abilityName: 'CUSPE ÁCIDO', abilityDesc: 'Lança esferas corrosivas incandescentes.', lore: 'Dissolve estruturas e carne viva.' },
    brute: { name: 'TITÃ DE CARNE', badge: 'Classe: Golias', icon: '🩸', createMesh: createBruteMonster, baseHealth: 8, baseSpeed: 15, color: '#ff5522', cooldown: 9.0, appearance: 'Colosso maciço de músculos costurados, costelas expostas, ombreira de osso e um gigantesco punho sísmico de espinhos.', colorDesc: 'Vinho sangrento e osso envelhecido.', size: '5.8m', texture: 'Carne rasgada e ferro.', features: 'Impacto sísmico devastador.', abilityName: 'IMPACTO SÍSMICO', abilityDesc: 'Esmaga o chão causando ondas de choque.', lore: 'O terror absoluto das salas de descarte.' },
    watcher: { name: 'O OBSERVADOR', badge: 'Classe: Psíquica', icon: '👁️', createMesh: createWatcherMonster, baseHealth: 6, baseSpeed: 18, color: '#eeff00', cooldown: 8.0, appearance: 'Globo ocular colossal com íris amarelo-sulfúrico, múltiplos tentáculos de nervo óptico e olhos satélites.', colorDesc: 'Oliva, amarelo sulfúrico e sangue.', size: '4.2m', texture: 'Esclera gelatinosa úmida.', features: 'Clarão paralisante.', abilityName: 'OLHAR CEGANTE', abilityDesc: 'Onda psíquica que cega o jogador temporariamente.', lore: 'Tudo vê nas entranhas do labirinto.' },
    butcher: { name: 'O AÇOUGUEIRO', badge: 'Classe: Carniceiro', icon: '🔪', createMesh: createButcherMonster, baseHealth: 7, baseSpeed: 19, color: '#ff3030', cooldown: 7.5, appearance: 'Carrasco imponente com avental encardido, máscara de ferro e um imenso cutelo banhado em sangue fresco.', colorDesc: 'Ferro oxidado e vermelho vivo.', size: '5.0m', texture: 'Couro grosso e metal.', features: 'Golpe de cutelo.', abilityName: 'CORTE BRUTAL', abilityDesc: 'Avanço pesado com lâmina enferrujada.', lore: 'Esquarteja tudo que respirar.' },
    backwalker: { name: 'CRIATURA DE COSTAS', badge: 'Classe: Perseguidor', icon: '🩻', createMesh: createBackwalkerMonster, baseHealth: 8, baseSpeed: 21, color: '#e5d2b0', cooldown: 7.0, appearance: 'Humanoide bizarro com torso torcido ao contrário, coluna com espinhos pontiagudos e cabeça invertida.', colorDesc: 'Cinza pálido cadavérico e osso.', size: '4.6m', texture: 'Pele seca rachada.', features: 'Passo invertido assustador.', abilityName: 'PASSO REVERSO', abilityDesc: 'Arrancada errática em zigue-zague.', lore: 'Anda de costas com velocidade estarrecedora.' },
    stalker: { name: 'O DEVORADOR PÁLIDO', badge: 'Classe: Predador', icon: '👤', createMesh: createPaleStalkerMonster, baseHealth: 7, baseSpeed: 22, color: '#88ddff', cooldown: 6.8, appearance: 'Humanoide pálido e desnutrido com costelas quebradas, garras de 1.2m e uma mandíbula vertical profunda.', colorDesc: 'Pele cadavérica e garras de obsidiana.', size: '4.8m', texture: 'Pele pálida esticada.', features: 'Investida rápida.', abilityName: 'BOTE DO VÁCUO', abilityDesc: 'Arrancada instantânea com garras compridas.', lore: 'Espreita silencioso nas esquinas dos corredores.' },
    brood: { name: 'MÃE DAS LARVAS', badge: 'Classe: Colmeia', icon: '🐛', createMesh: createBroodmotherMesh, baseHealth: 10, baseSpeed: 18, color: '#39ff14', cooldown: 8.0, appearance: 'Rainha insetoide colossal com abdômen gigante repleto de casulos bioluminescentes e foices dianteiras.', colorDesc: 'Quitina verde-escura e ovos neon.', size: '5.4m', texture: 'Carapaça blindada úmida.', features: 'Bolsas de ovos ácidas.', abilityName: 'ENXAME PARALISANTE', abilityDesc: 'Dispara esporos corrosivos que reduzem velocidade.', lore: 'A soberana dos setores apodrecidos.' },
    ripper: { name: 'O RASGADOR', badge: 'Classe: Caçador Letal', icon: '⚡', createMesh: createRipperMesh, baseHealth: 11, baseSpeed: 24, color: '#ff0044', cooldown: 6.0, appearance: 'Assassino biomecânico com lâminas de foice de 2.8m, crista dorsal farpada e visor carmesim.', colorDesc: 'Armadura ônix e lâminas escarlates.', size: '5.2m', texture: 'Liga metálica espinhosa.', features: 'Frenesi de lâminas.', abilityName: 'FRENESI CORTANTE', abilityDesc: 'Arrancada veloz girando lâminas gigantes.', lore: 'Caçador implacável das profundezas.' },
    gravedigger: { name: 'O COVEIRO', badge: 'Classe: Colosso Gótico', icon: '⚰️', createMesh: createGravediggerMesh, baseHealth: 13, baseSpeed: 17, color: '#33ffaa', cooldown: 8.5, appearance: 'Espectro colossal de cartola torta, sobretudo longo, imensa pá ensanguentada e lanterna de fogo espectral.', colorDesc: 'Cinza fúnebre e chama verde-fantasma.', size: '5.8m', texture: 'Tecido podre e ferro.', features: 'Terremoto da pá.', abilityName: 'TERREMOTO FÚNEBRE', abilityDesc: 'Bate a pá contra o piso gerando onda sísmica.', lore: 'Sepulta vivos aqueles que desafiam o labirinto.' },
    bride: { name: 'A NOIVA VAZIA', badge: 'Classe: Entidade Ancestral', icon: '👰', createMesh: createHollowBrideMesh, baseHealth: 14, baseSpeed: 23, color: '#d000ff', cooldown: 6.5, appearance: 'Espectro flutuante com véu nupcial esfarrapado, coroa de espinhos, coração violeta e lágrimas cintilantes.', colorDesc: 'Púrpura translúcido e osso envelhecido.', size: '5.6m', texture: 'Gaze translúcida e névoa.', features: 'Lamento da alma.', abilityName: 'LAMENTO ANCESTRAL', abilityDesc: 'Onda psíquica devastadora com dano e distorção.', lore: 'A manifestação da dor eterna deste reino.' }
};

// 12 MONSTROS TOTALMENTE EXCLUSIVOS (NENHUM REPETIDO EM NENHUMA FASE!)
const PHASE_1_MONSTERS = ['skull', 'arachnid', 'spitter', 'brute'];
const PHASE_2_MONSTERS = ['watcher', 'butcher', 'backwalker', 'stalker'];
const PHASE_3_MONSTERS = ['brood', 'ripper', 'gravedigger', 'bride'];

function showMonsterSpawnCard(profile) {
    const card = document.getElementById('monsterSpawnCard');
    const nameEl = document.getElementById('spawnCardName');
    const descEl = document.getElementById('spawnCardDesc');
    if (!card || !nameEl || !descEl) return;
    nameEl.textContent = `${profile.icon || ''} ${profile.name}`;
    nameEl.style.color = profile.color;
    descEl.innerHTML = `<strong>Aparência:</strong> ${profile.appearance}<br><span style="color:#ffaaaa;font-size:0.8rem;">Cor: ${profile.colorDesc} • Tamanho: ${profile.size}</span>`;
    card.classList.add('show');
    setTimeout(() => card.classList.remove('show'), 4200);
}

function showAbilityAlert(monsterName, abilityName, color) {
    abilityBanner.textContent = `⚠️ ${monsterName}: ${abilityName}!`;
    abilityBanner.style.color = color || '#ff3333';
    abilityBanner.classList.add('show');
    setTimeout(() => abilityBanner.classList.remove('show'), 2400);
}

// SPAWN MAIS PRÓXIMO DO JOGADOR (MUITO MAIS FÁCIL DE ENCONTRAR OS MONSTROS!)
function findSafeMonsterSpawn() {
    const p = controls.getObject().position, candidates = [];
    for(let z=1; z<gridSize-1; z++) for(let x=1; x<gridSize-1; x++) {
        if(!isWalkableCell(z,x)) continue;
        const d = Math.hypot(x*cellSize - p.x, z*cellSize - p.z);
        // Distância ideal reduzida: entre 26m e 58m (não fica longe no labirinto)
        if(d >= 26 && d <= 58) candidates.push({x,z,d});
    }
    if(!candidates.length) {
        // Fallback caso não ache na faixa estreita
        for(let z=1; z<gridSize-1; z++) for(let x=1; x<gridSize-1; x++) {
            if(!isWalkableCell(z,x)) continue;
            const d = Math.hypot(x*cellSize - p.x, z*cellSize - p.z);
            if(d >= 20 && d <= 80) candidates.push({x,z,d});
        }
    }
    if(!candidates.length) return null;
    candidates.sort((a,b) => a.d - b.d);
    const c = candidates[Math.floor(Math.random()*Math.min(5, candidates.length))];
    const pos = new THREE.Vector3(c.x*cellSize, 0, c.z*cellSize);
    return { position: pos, normal: new THREE.Vector3().subVectors(p, pos).setY(0).normalize() };
}

function spawnNextMonster() {
    if (!isGameRunning || currentMonsterAlive || currentMonsterIndex >= targetKills) return;
    const spawnData = findSafeMonsterSpawn();
    if (!spawnData) { scheduleNextMonster(2, 4); return; }

    const monsterSeq = currentPhase === 1 ? PHASE_1_MONSTERS : (currentPhase === 2 ? PHASE_2_MONSTERS : PHASE_3_MONSTERS);
    const key = monsterSeq[currentMonsterIndex % monsterSeq.length];
    const profile = MONSTER_PROFILES[key] || MONSTER_PROFILES.skull;

    const monsterGroup = profile.createMesh();
    // Torna os monstros maiores e aterrorizantes!
    const monsterScale = currentPhase === 3 ? 1.55 : (currentPhase === 2 ? 1.4 : 1.28);
    monsterGroup.scale.set(monsterScale, monsterScale, monsterScale);
    monsterGroup.position.copy(spawnData.position);
    scene.add(monsterGroup);

    showMonsterSpawnCard(profile);
    playSfx('roar');

    const plate = document.createElement('div');
    plate.className = 'monster-plate';
    const nameTag = document.createElement('div');
    nameTag.className = 'monster-name-tag';
    nameTag.textContent = profile.name;
    nameTag.style.color = profile.color;
    const hpBg = document.createElement('div');
    hpBg.className = 'monster-hp-bg';
    const hpBar = document.createElement('div');
    hpBar.className = 'monster-hp-bar';
    hpBar.style.backgroundColor = profile.color;
    hpBg.appendChild(hpBar);
    plate.appendChild(nameTag); plate.appendChild(hpBg);
    hpContainer.appendChild(plate);

    const hpMultiplier = currentPhase === 3 ? 2.5 : (currentPhase === 2 ? 1.4 : 1.0);
    let health = Math.round(profile.baseHealth * hpMultiplier);

    const monster = {
        type: key, name: profile.name, mesh: monsterGroup,
        health: health, maxHealth: health,
        speed: Math.min(8.0, (profile.baseSpeed * 0.26) + (currentPhase===3?0.8:(currentPhase===2?0.4:0))),
        hpPlate: plate, hpBar: hpBar, color: profile.color,
        emerging: true, emergeStart: performance.now(), emergeDuration: 1400,
        startPosition: spawnData.position.clone(),
        emergePosition: spawnData.position.clone().addScaledVector(spawnData.normal, 2.5),
        floatOffset: Math.random() * Math.PI * 2, attackCooldown: 0,
        abilityTimer: 4.0, abilityCooldown: profile.cooldown,
        isUsingAbility: false, leapProgress: 0,
        leapStartPos: new THREE.Vector3(), leapTargetPos: new THREE.Vector3(),
        path: [], pathTimer: 0, pathIndex: 0
    };

    monsters.push(monster);
    currentMonsterAlive = true;
    currentMonsterIndex++;
    if (radarHud) radarHud.style.display = 'flex';
}

function scheduleNextMonster(minSec = 4, maxSec = 8) {
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => {
        if (isGameRunning && !currentMonsterAlive) spawnNextMonster();
    }, (minSec + Math.random()*(maxSec-minSec)) * 1000);
}

function spawnMonsters() {
    clearTimeout(spawnTimer);
    currentMonsterIndex = 0; currentMonsterAlive = false; kills = 0;
    uiKills.innerText = `0 / ${targetKills}`;
    scheduleNextMonster(2, 4);
}

function triggerMonsterAbility(monster) {
    if (!monster || !monster.mesh || !isGameRunning) return;
    const pPos = controls.getObject().position;
    const mPos = monster.mesh.position;
    const dist = mPos.distanceTo(pPos);

    switch(monster.type) {
        case 'skull':
            showAbilityAlert(monster.name, 'GRITO ENSURDECEDOR', monster.color);
            playSfx('hit');
            spawnShockwaveRing(mPos.clone().add(new THREE.Vector3(0, 4, 0)), 0x33e5ff);
            if (dist < 32) {
                shockwaveOverlay.style.opacity = '1';
                setTimeout(() => shockwaveOverlay.style.opacity = '0', 400);
                playerSlowTimer = 2.2;
                takeDamage(10);
            }
            break;
        case 'arachnid':
            if (dist > 12 && dist < 45) {
                showAbilityAlert(monster.name, 'INVESTIDA DAS TREVAS', monster.color);
                playSfx('hit');
                monster.isUsingAbility = true; monster.leapProgress = 0;
                monster.leapStartPos.copy(mPos);
                const leapPath = findPath(mPos, pPos);
                if(leapPath.length) {
                    const n = leapPath[Math.min(1, leapPath.length-1)];
                    monster.leapTargetPos.set(n[0]*cellSize, 0, n[1]*cellSize);
                } else { monster.isUsingAbility = false; }
            }
            break;
        case 'brute':
            showAbilityAlert(monster.name, 'IMPACTO SÍSMICO', monster.color);
            playSfx('hit');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 0.2, mPos.z), 0xff3300, 36);
            if (dist < 26) {
                takeDamage(18);
                const push = new THREE.Vector3().subVectors(pPos, mPos).normalize().multiplyScalar(14);
                if(!collidesWithWalls(pPos.x+push.x, pPos.z+push.z, PLAYER_RADIUS))
                    controls.getObject().position.set(pPos.x+push.x, 6, pPos.z+push.z);
            }
            break;
        case 'watcher':
            showAbilityAlert(monster.name, 'OLHAR CEGANTE', monster.color);
            playSfx('hit');
            blindnessOverlay.style.opacity = '0.98';
            setTimeout(() => blindnessOverlay.style.opacity = '0', 2500);
            break;
        case 'spitter':
            if (dist > 10 && dist < 50) {
                showAbilityAlert(monster.name, 'CUSPE ÁCIDO', monster.color);
                playSfx('hit');
                spawnAcidProjectile(mPos.clone().add(new THREE.Vector3(0, 5, 0)), pPos.clone().add(new THREE.Vector3(0, 2, 0)));
            }
            break;
        case 'butcher':
            showAbilityAlert(monster.name, 'CORTE BRUTAL', monster.color);
            playSfx('hit');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 0.2, mPos.z), 0xff2222, 28);
            if (dist < 22) {
                takeDamage(24);
                playerSlowTimer = 1.5;
            }
            break;
        case 'backwalker':
            showAbilityAlert(monster.name, 'PASSO REVERSO', monster.color);
            playSfx('hit');
            monster.speed = 13.0; // Arrancada errática
            setTimeout(() => { monster.speed = (profile.baseSpeed * 0.26) + 0.4; }, 1800);
            break;
        case 'stalker':
            showAbilityAlert(monster.name, 'BOTE DO VÁCUO', monster.color);
            playSfx('hit');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 1.0, mPos.z), 0x88ddff, 22);
            if (dist > 8 && dist < 36) {
                const leapPath = findPath(mPos, pPos);
                if (leapPath.length) {
                    const stepNode = leapPath[Math.min(2, leapPath.length - 1)];
                    mPos.set(stepNode[0] * cellSize, 0, stepNode[1] * cellSize);
                }
            }
            break;
        case 'brood':
            showAbilityAlert(monster.name, 'ENXAME PARALISANTE', monster.color);
            playSfx('hit');
            spawnAcidProjectile(mPos.clone().add(new THREE.Vector3(0, 5, 0)), pPos.clone().add(new THREE.Vector3(0, 2, 0)));
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 0.2, mPos.z), 0x39ff14, 30);
            if (dist < 28) {
                playerSlowTimer = 2.5;
                takeDamage(12);
            }
            break;
        case 'ripper':
            showAbilityAlert(monster.name, 'FRENESI CORTANTE', monster.color);
            playSfx('hit');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 2.0, mPos.z), 0xff0044, 34);
            if (dist < 26) {
                takeDamage(22);
            }
            break;
        case 'gravedigger':
            showAbilityAlert(monster.name, 'TERREMOTO FÚNEBRE', monster.color);
            playSfx('thunder');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 0.2, mPos.z), 0x33ffaa, 40);
            if (dist < 32) {
                takeDamage(25);
                const push = new THREE.Vector3().subVectors(pPos, mPos).normalize().multiplyScalar(16);
                if(!collidesWithWalls(pPos.x+push.x, pPos.z+push.z, PLAYER_RADIUS))
                    controls.getObject().position.set(pPos.x+push.x, 6, pPos.z+push.z);
            }
            break;
        case 'bride':
            showAbilityAlert(monster.name, 'LAMENTO ANCESTRAL', monster.color);
            playSfx('hit');
            spawnShockwaveRing(new THREE.Vector3(mPos.x, 3.0, mPos.z), 0xd000ff, 42);
            blindnessOverlay.style.opacity = '0.75';
            setTimeout(() => blindnessOverlay.style.opacity = '0', 1600);
            if (dist < 34) {
                takeDamage(20);
                playerSlowTimer = 3.0;
            }
            break;
    }
}

function spawnAcidProjectile(startPos, targetPos) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshBasicMaterial({ color: 0x39ff14 }));
    mesh.position.copy(startPos);
    mesh.add(new THREE.PointLight(0x39ff14, 2.0, 10));
    scene.add(mesh);
    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
    acidProjectiles.push({ mesh, velocity: dir.multiplyScalar(42), life: 2.5 });
}

function spawnShockwaveRing(position, colorHex = 0xffffff, maxScale = 25) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.8, 24), new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(position); scene.add(ring);
    shockwaveRings.push({ mesh: ring, scale: 1, maxScale, opacity: 0.85 });
}

function startCinematic() {
    try { if(audioCtx && audioCtx.state==='suspended') audioCtx.resume(); } catch(e) {}
    startGameMusic();
    const intro = document.getElementById('introScreen');
    if (intro) { intro.style.opacity = '0'; setTimeout(() => intro.style.display = 'none', 850); }

    createPlayerSpawn();
    isIntroPlaying = true;
    const startX = camera.position.x, startZ = camera.position.z;
    const startTime = performance.now();

    function cinematicLoop(now) {
        if (isGameRunning) { isIntroPlaying = false; return; }
        const t = Math.min((now - startTime) / 2200, 1);
        camera.position.set(startX, 6, startZ);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(0, 0, 0);
        renderer.render(scene, camera);
        if (t < 1) requestAnimationFrame(cinematicLoop);
        else {
            createPlayerSpawn();
            isIntroPlaying = false;
            updateLevelPromptUI(1);
            startPrompt.style.display = 'flex';
        }
    }
    requestAnimationFrame(cinematicLoop);
}

function updateLevelPromptUI(lvl) {
    if (levelPromptText) {
        levelPromptText.textContent = `LEVEL ${lvl}`;
    }
}

function startGameplay() {
    startPrompt.style.display = 'none';
    isSprinting = false;
    startGameMusic();
    isGameRunning = true;
    createPlayerSpawn();
    clock.getDelta();
    toggleUI(true);
    try { if(audioCtx && audioCtx.state==='suspended') audioCtx.resume(); } catch(e) {}
    try { controls.lock(); } catch(e) {}
    spawnMonsters();
}

function onKeyDown(event) {
    if (event.code === 'KeyB' || event.key === 'b' || event.key === 'B') {
        if (document.getElementById('bestiaryModal').style.display === 'flex') closeBestiary();
        else openBestiary();
        return;
    }
    if (event.code === 'Escape' && document.getElementById('bestiaryModal').style.display === 'flex') {
        closeBestiary();
        return;
    }
    if (!isGameRunning) return;
    const k = (event.key || '').toLowerCase();
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') isSprinting = true;
    if (event.code === 'KeyW' || event.code === 'ArrowUp' || k === 'w') moveForward = true;
    if (event.code === 'KeyS' || event.code === 'ArrowDown' || k === 's') moveBackward = true;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft' || k === 'a') moveLeft = true;
    if (event.code === 'KeyD' || event.code === 'ArrowRight' || k === 'd') moveRight = true;
    if (event.code === 'KeyR' || k === 'r') reloadGun();
    if (event.code === 'Space' || event.keyCode === 32) shootGun();
}

function onKeyUp(event) {
    if (!isGameRunning) return;
    const k = (event.key || '').toLowerCase();
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') isSprinting = false;
    if (event.code === 'KeyW' || event.code === 'ArrowUp' || k === 'w') moveForward = false;
    if (event.code === 'KeyS' || event.code === 'ArrowDown' || k === 's') moveBackward = false;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft' || k === 'a') moveLeft = false;
    if (event.code === 'KeyD' || event.code === 'ArrowRight' || k === 'd') moveRight = false;
}

let isPointerDragging = false, prevMouseX = 0, prevMouseY = 0;
function onMouseDown(event) {
    if (document.getElementById('bestiaryModal').style.display === 'flex' || !isGameRunning) return;
    isPointerDragging = true; prevMouseX = event.clientX; prevMouseY = event.clientY;
    if (event.button === 0) shootGun();
    if (!controls.isLocked) try { controls.lock(); } catch(e) {}
}
function onMouseUp() { isPointerDragging = false; }
function onMouseMove(event) {
    if (document.getElementById('bestiaryModal').style.display === 'flex' || !isGameRunning) return;
    if (!controls.isLocked && isPointerDragging) {
        const deltaX = event.clientX - prevMouseX, deltaY = event.clientY - prevMouseY;
        prevMouseX = event.clientX; prevMouseY = event.clientY;
        camera.rotation.order = 'YXZ';
        camera.rotation.y -= deltaX * 0.0025;
        camera.rotation.x -= deltaY * 0.0025;
        camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));
    }
}

// ============================================================
// SISTEMA DE SANGUE VISCERAL EXPLOSIVO
// A tela NÃO fica vermelha em primeira pessoa quando o jogador atira!
// Muito mais sangue jorra dos monstros: poças no chão E manchas escorrendo nas paredes!
// ============================================================
function createWallBloodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    
    // Núcleo espesso do respingo na parede
    ctx.fillStyle = '#5c0000';
    ctx.beginPath();
    ctx.ellipse(128, 90, 48, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gotículas espirradas em todas as direções
    for (let i = 0; i < 55; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 88;
        const rad = 2 + Math.random() * 7;
        ctx.fillStyle = Math.random() > 0.4 ? '#8a0000' : '#3e0000';
        ctx.beginPath();
        ctx.arc(128 + Math.cos(ang) * dist, 90 + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
        ctx.fill();
    }

    // Escorridos verticais de sangue fresco na parede
    ctx.strokeStyle = '#500000';
    ctx.lineWidth = 3.5;
    for (let d = 0; d < 7; d++) {
        const sx = 92 + d * 12;
        ctx.beginPath();
        ctx.moveTo(sx, 110);
        ctx.lineTo(sx + (Math.random() - 0.5) * 8, 175 + Math.random() * 75);
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

const wallBloodTexture = createWallBloodTexture();

function createWallBloodSplatter(pos) {
    if (wallBloodDecals.length > 35) {
        const old = wallBloodDecals.shift();
        scene.remove(old);
    }
    // Detecta parede próxima dentro do raio de impacto
    const directions = [
        { dx: -1, dz: 0, rotY: Math.PI / 2 },
        { dx: 1, dz: 0, rotY: -Math.PI / 2 },
        { dx: 0, dz: -1, rotY: 0 },
        { dx: 0, dz: 1, rotY: Math.PI }
    ];
    for (const dir of directions) {
        const checkX = pos.x + dir.dx * 5.2;
        const checkZ = pos.z + dir.dz * 5.2;
        const gx = Math.round(checkX / cellSize);
        const gz = Math.round(checkZ / cellSize);
        if (gz >= 0 && gz < gridSize && gx >= 0 && gx < gridSize && map[gz] && map[gz][gx] === 1) {
            const wallCenterX = gx * cellSize;
            const wallCenterZ = gz * cellSize;
            const decalGeo = new THREE.PlaneGeometry(4.2, 5.4);
            const decalMat = new THREE.MeshBasicMaterial({
                map: wallBloodTexture,
                transparent: true,
                opacity: 0.92,
                depthWrite: false
            });
            const decal = new THREE.Mesh(decalGeo, decalMat);
            
            let wallFaceX = wallCenterX - dir.dx * (cellSize / 2 - 0.08);
            let wallFaceZ = wallCenterZ - dir.dz * (cellSize / 2 - 0.08);
            decal.position.set(wallFaceX, Math.max(2.5, pos.y + (Math.random() - 0.5) * 2), wallFaceZ);
            decal.rotation.y = dir.rotY;
            scene.add(decal);
            wallBloodDecals.push(decal);
            break;
        }
    }
}

function spawnMassiveBloodSplatter(position) {
    playSfx('splatter');

    // NOTA: A tela do jogador NÃO fica vermelha em primeira pessoa ao acertar o monstro!
    // A tela só pisca quando o próprio jogador recebe dano!

    const bloodGeo = new THREE.SphereGeometry(0.25, 5, 5);
    const darkBloodMat = new THREE.MeshBasicMaterial({ color: 0x6e0000 });
    const brightBloodMat = new THREE.MeshBasicMaterial({ color: 0xbd0000 });
    const blackBloodMat = new THREE.MeshBasicMaterial({ color: 0x220000 });

    const particleCount = 200; // Erupção massiva de mais de 200 partículas!
    for(let i = 0; i < particleCount; i++) {
        const mat = i % 3 === 0 ? brightBloodMat : (i % 3 === 1 ? darkBloodMat : blackBloodMat);
        const drop = new THREE.Mesh(bloodGeo, mat);
        drop.position.copy(position);
        
        const scale = 0.5 + Math.random() * 1.8;
        drop.scale.set(scale, scale, scale);
        scene.add(drop);

        const angle = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * 30;
        const velY = (Math.random() - 0.15) * 24;
        bloodParticles.push({
            mesh: drop,
            velocity: new THREE.Vector3(Math.cos(angle) * speed, velY, Math.sin(angle) * speed),
            life: 1.3 + Math.random() * 0.7
        });
    }

    // Cria poça de sangue permanente no chão
    createFloorBloodPool(position.x, position.z);
    // Cria manchas e escorridos de sangue nas paredes próximas!
    createWallBloodSplatter(position);
}

function createFloorBloodPool(x, z) {
    if (floorBloodDecals.length > 25) {
        const old = floorBloodDecals.shift();
        scene.remove(old);
    }
    const radius = 1.2 + Math.random() * 1.8;
    const poolGeo = new THREE.CircleGeometry(radius, 12);
    const poolMat = new THREE.MeshBasicMaterial({
        color: 0x4a0000,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x + (Math.random() - 0.5) * 1.5, 0.05, z + (Math.random() - 0.5) * 1.5);
    scene.add(pool);
    floorBloodDecals.push(pool);
}

function shootGun() {
    if (isReloading || fireCooldown > 0) return;
    fireCooldown = weaponType === 'machinegun' ? 0.11 : (weaponType === 'shotgun' ? 0.65 : 0.25);
    if (ammo <= 0) { reloadGun(); return; }

    ammo--; uiAmmo.innerText = ammo; playSfx('shot');
    gunMesh.position.z += 0.8; gunMesh.rotation.x += 0.5; gunRecoilTimer = 0.2;
    muzzleFlashLight.intensity = 5;
    setTimeout(() => { muzzleFlashLight.intensity = 0; }, 50);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const monsterMeshes = monsters.map(m => m.mesh);
    let intersects = raycaster.intersectObjects(monsterMeshes, true);

    if (intersects.length > 0) {
        let hitObject = intersects[0].object;
        while(hitObject.parent && hitObject.parent.type !== "Scene") {
            if (monsterMeshes.includes(hitObject)) break;
            hitObject = hitObject.parent;
        }
        if (monsterMeshes.includes(hitObject)) {
            playSfx('hit');
            spawnMassiveBloodSplatter(intersects[0].point);
            for (let i = 0; i < monsters.length; i++) {
                if (monsters[i].mesh === hitObject) {
                    monsters[i].health -= weaponDamage;
                    const kb = raycaster.ray.direction.clone().multiplyScalar(2.4);
                    moveEntityWithCollision(monsters[i].mesh, kb.x, kb.z, MONSTER_RADIUS);
                    if (monsters[i].health <= 0) killMonster(i);
                    break;
                }
            }
        }
    }
    if (ammo === 0) reloadGun();
}

function reloadGun() {
    if (isReloading || ammo === maxAmmo) return;
    isReloading = true; uiReload.style.display = 'block';
    gunMesh.rotation.x = -Math.PI / 2.5; gunMesh.position.y -= 0.8;
    setTimeout(() => {
        ammo = maxAmmo; uiAmmo.innerText = ammo; isReloading = false;
        uiReload.style.display = 'none';
        gunMesh.rotation.x = 0; gunMesh.position.y = -0.5;
    }, 1400);
}

function killMonster(index) {
    scene.remove(monsters[index].mesh);
    if (monsters[index].hpPlate) monsters[index].hpPlate.remove();
    monsters.splice(index, 1);
    kills++; uiKills.innerText = `${kills} / ${targetKills}`;
    currentMonsterAlive = false;
    if (radarHud) radarHud.style.display = 'none';
    if (kills >= targetKills) setTimeout(endGameWin, 500);
    else scheduleNextMonster(3, 7);
}

function takeDamage(amount = 20) {
    playerHealth -= amount;
    if (playerHealth < 0) playerHealth = 0;
    uiHealth.innerText = playerHealth;
    
    damageOverlay.style.background = "radial-gradient(circle, transparent 40%, rgba(200, 0, 0, 0.9) 100%)";
    damageOverlay.style.opacity = '1';
    setTimeout(() => { damageOverlay.style.opacity = '0'; }, 300);
    
    if (gunMesh) {
        gunMesh.position.z += 0.4;
        gunMesh.rotation.x += 0.25;
        gunRecoilTimer = 0.25;
    }

    if (playerHealth <= 0) endGameLose();
}

function endGameWin() {
    isGameRunning = false;
    stopGameMusic(); controls.unlock(); toggleUI(false);
    if (currentPhase === 1) {
        document.getElementById('winTitle').textContent = 'LEVEL 1 CONCLUÍDO';
        document.getElementById('winMessage').textContent = 'As paredes mudam de cor. Prepare-se para o Level 2.';
        document.getElementById('nextPhaseBtn').style.display = 'block';
        document.getElementById('nextPhaseBtn').textContent = 'ENTRAR NO LEVEL 2';
    } else if (currentPhase === 2) {
        document.getElementById('winTitle').textContent = 'LEVEL 2 CONCLUÍDO';
        document.getElementById('winMessage').textContent = 'O pesadelo se intensifica no Level 3.';
        document.getElementById('nextPhaseBtn').style.display = 'block';
        document.getElementById('nextPhaseBtn').textContent = 'ENTRAR NO LEVEL 3';
    } else {
        document.getElementById('winTitle').textContent = 'LEVEL 3 CONCLUÍDO';
        document.getElementById('winMessage').textContent = 'VOCÊ SOBREVIVEU AO LABIRINTO COMPLETO!';
        document.getElementById('nextPhaseBtn').style.display = 'none';
    }
    document.getElementById('winScreen').style.display = 'flex';
}

function startNextPhase() {
    if (phaseTransitioning) return;
    phaseTransitioning = true;
    document.getElementById('winScreen').style.display = 'none';
    currentPhase = currentPhase === 1 ? 2 : 3;
    targetKills = currentPhase === 2 ? 8 : 12;
    mazeTheme = 'yellow'; kills = 0; currentMonsterIndex = 0; currentMonsterAlive = false;
    playerHealth = 100; uiHealth.innerText = '100';
    setWeapon(currentPhase === 2 ? 'shotgun' : 'machinegun');
    generateMaze(createWallTexture('yellow'), createBloodTexture('skull'), createBloodTexture('devil'));
    createPlayerSpawn();
    
    updateLevelPromptUI(currentPhase);
    phaseTransitioning = false;
    startPrompt.style.display = 'flex';
}

function endGameLose() {
    isGameRunning = false;
    stopGameMusic(); controls.unlock(); toggleUI(false);
    document.getElementById('loseScreen').style.display = 'flex';
}

// BESTIÁRIO (SEM O VULTO!)
function initBestiary() {
    const tabs = document.getElementById('bestiaryTabs');
    document.getElementById('closeBestiaryBtn').addEventListener('click', closeBestiary);
    document.getElementById('bestiaryMenuBtn').addEventListener('click', openBestiary);
    document.getElementById('hudBestiaryBtn').addEventListener('click', openBestiary);
    if (!tabs) return;
    tabs.innerHTML = '';
    Object.keys(MONSTER_PROFILES).forEach((key, idx) => {
        const p = MONSTER_PROFILES[key];
        const btn = document.createElement('button');
        btn.className = `bestiary-tab-btn ${idx === 0 ? 'active' : ''}`;
        btn.id = `tab_${key}`;
        btn.innerHTML = `<span>${p.icon || '👾'}</span> <span>${p.name}</span>`;
        btn.onclick = () => selectBestiary(key);
        tabs.appendChild(btn);
    });
    selectBestiary('skull');
}
function openBestiary() {
    document.getElementById('bestiaryModal').style.display = 'flex';
    if (controls && controls.isLocked) try { controls.unlock(); } catch(e) {}
}
function closeBestiary() {
    document.getElementById('bestiaryModal').style.display = 'none';
    if (isGameRunning && playerHealth > 0) try { controls.lock(); } catch(e) {}
}
function selectBestiary(key) {
    const p = MONSTER_PROFILES[key];
    if (!p) return;
    document.querySelectorAll('.bestiary-tab-btn').forEach(b => b.classList.remove('active'));
    const active = document.getElementById(`tab_${key}`);
    if (active) active.classList.add('active');
    const c = document.getElementById('bestiaryContent');
    c.innerHTML = `
        <div style="border-bottom: 2px solid ${p.color}; padding-bottom:10px; margin-bottom:18px;">
            <div style="font-family:'Creepster'; font-size:2.2rem; color:${p.color};">${p.icon} ${p.name}</div>
            <div style="font-size:0.85rem; color:#aaa; margin-top:4px;">
                <span class="bestiary-pill" style="border:1px solid ${p.color}; color:${p.color}">${p.badge}</span>
                <span class="bestiary-pill" style="background:#331111; color:#ff8888">Vida: ${p.baseHealth}</span>
                <span class="bestiary-pill" style="background:#112233; color:#88ccff">Vel: ${p.baseSpeed} m/s</span>
            </div>
        </div>
        <div class="bestiary-prop-group" style="border-left-color:${p.color}">
            <div class="bestiary-prop-title">Aparência & Forma</div><div class="bestiary-prop-value">${p.appearance}</div>
        </div>
        <div class="bestiary-prop-group" style="border-left-color:#ff3333">
            <div class="bestiary-prop-title">Habilidade: ${p.abilityName}</div><div class="bestiary-prop-value">${p.abilityDesc}</div>
        </div>
        <div class="bestiary-prop-group" style="border-left-color:#888">
            <div class="bestiary-prop-title">Relato de Campo</div><div class="bestiary-prop-value" style="font-style:italic">"${p.lore}"</div>
        </div>
    `;
}

// ============================================================
// ATUALIZAÇÃO DO DETECTOR/RADAR PARA ACHAR MONSTROS FACILMENTE
// ============================================================
function updateMonsterRadar() {
    if (!radarHud || !radarText || !radarArrow) return;
    if (!currentMonsterAlive || monsters.length === 0) {
        radarHud.style.display = 'none';
        return;
    }
    const monster = monsters[0];
    const pPos = controls.getObject().position;
    const mPos = monster.mesh.position;
    
    // Distância em metros
    const dist = Math.round(pPos.distanceTo(mPos));
    
    // Ângulo relativo à direção de visão do jogador
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();

    const toMonster = new THREE.Vector3().subVectors(mPos, pPos);
    toMonster.y = 0; toMonster.normalize();

    const forwardDot = camDir.dot(toMonster); // 1 = frente, -1 = trás
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
    const rightDot = right.dot(toMonster);   // >0 = direita, <0 = esquerda

    let arrow = '⬆️';
    if (forwardDot > 0.65) arrow = '⬆️';
    else if (forwardDot < -0.65) arrow = '⬇️';
    else if (rightDot > 0.4) arrow = forwardDot > 0 ? '↗️' : '↘️';
    else if (rightDot < -0.4) arrow = forwardDot > 0 ? '↖️' : '↙️';

    radarText.textContent = `ENTIDADE: ${monster.name} [${dist}m]`;
    radarArrow.textContent = arrow;
    radarHud.style.display = 'flex';
}

// LOOP PRINCIPAL
function animate() {
    requestAnimationFrame(animate);

    if (isIntroPlaying) { renderer.render(scene, camera); return; }
    if (!isGameRunning) { renderer.render(scene, camera); return; }

    const delta = Math.min(clock.getDelta(), 0.05);
    fireCooldown = Math.max(0, fireCooldown - delta);
    updateWeather(delta);
    updateMonsterRadar();

    if (gunRecoilTimer > 0) {
        gunRecoilTimer -= delta;
        gunMesh.position.z = THREE.MathUtils.lerp(gunMesh.position.z, -1.2, 10 * delta);
        gunMesh.rotation.x = THREE.MathUtils.lerp(gunMesh.rotation.x, 0, 10 * delta);
    }

    if (playerSlowTimer > 0) playerSlowTimer -= delta;
    if (playerAcidBurnTimer > 0) {
        playerAcidBurnTimer -= delta;
        if (Math.random() < 0.08) takeDamage(1);
    }

    // Partículas de Sangue Visceral
    for (let i = bloodParticles.length - 1; i >= 0; i--) {
        let p = bloodParticles[i];
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= 45 * delta; // Gravidade acentuada para jatos
        p.life -= delta * 1.1;
        if (p.life <= 0 || p.mesh.position.y <= 0.1) {
            scene.remove(p.mesh);
            bloodParticles.splice(i, 1);
        }
    }

    // Projéteis Ácidos
    const pPosNow = controls.getObject().position;
    for (let i = acidProjectiles.length - 1; i >= 0; i--) {
        const proj = acidProjectiles[i];
        proj.mesh.position.addScaledVector(proj.velocity, delta);
        proj.life -= delta;
        if (collidesWithWalls(proj.mesh.position.x, proj.mesh.position.z, 0.25)) {
            scene.remove(proj.mesh); acidProjectiles.splice(i, 1); continue;
        }
        if (proj.mesh.position.distanceTo(pPosNow) < 3.2) {
            takeDamage(15);
            acidOverlay.style.opacity = '0.9'; setTimeout(() => acidOverlay.style.opacity = '0', 800);
            scene.remove(proj.mesh); acidProjectiles.splice(i, 1); continue;
        }
        if (proj.life <= 0 || proj.mesh.position.y <= 0.2) {
            scene.remove(proj.mesh); acidProjectiles.splice(i, 1);
        }
    }

    // Ondas de Choque
    for (let i = shockwaveRings.length - 1; i >= 0; i--) {
        const sw = shockwaveRings[i];
        sw.scale += delta * 24; sw.opacity -= delta * 1.1;
        sw.mesh.scale.set(sw.scale, sw.scale, sw.scale);
        sw.mesh.material.opacity = Math.max(0, sw.opacity);
        if (sw.opacity <= 0 || sw.scale >= sw.maxScale) {
            scene.remove(sw.mesh); shockwaveRings.splice(i, 1);
        }
    }

    // CÁLCULO DE MOVIMENTO WASD
    const sprinting = isSprinting && (moveForward || moveBackward || moveLeft || moveRight);
    const currentSpeed = (playerSlowTimer > 0 ? basePlayerSpeed * 0.5 : basePlayerSpeed) *
        (sprinting ? sprintMultiplier : 1);
    const sprintHud = document.getElementById('sprintHud');
    if (sprintHud) sprintHud.classList.toggle('running', sprinting);
    const forwardMove = Number(moveForward) - Number(moveBackward);
    const sideMove = Number(moveRight) - Number(moveLeft);

    const obj = controls.getObject();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const wish = new THREE.Vector3();
    if (forwardMove !== 0 || sideMove !== 0) {
        wish.addScaledVector(right, sideMove);
        wish.addScaledVector(forward, forwardMove);
        wish.normalize().multiplyScalar(currentSpeed * delta);
    }

    if (wish.lengthSq() > 0.000001) {
        const testX = obj.position.x + wish.x;
        const testZ = obj.position.z + wish.z;
        if (!collidesWithWalls(testX, obj.position.z, PLAYER_RADIUS)) obj.position.x = testX;
        if (!collidesWithWalls(obj.position.x, testZ, PLAYER_RADIUS)) obj.position.z = testZ;
    }
    obj.position.y = 6;

    if (collidesWithWalls(obj.position.x, obj.position.z, PLAYER_RADIUS * 0.8)) {
        const cellCenter = worldToCell(obj.position);
        obj.position.x = THREE.MathUtils.lerp(obj.position.x, cellCenter.x * cellSize, 0.15);
        obj.position.z = THREE.MathUtils.lerp(obj.position.z, cellCenter.z * cellSize, 0.15);
    }

    updateHealthPickups(delta);

    // ATUALIZAÇÃO DOS MONSTROS
    for (let i = monsters.length - 1; i >= 0; i--) {
        const monster = monsters[i];
        if (!monster || !monster.mesh) continue;
        const pPos = controls.getObject().position;
        const mPos = monster.mesh.position;

        const screenPos = mPos.clone();
        const isBoss = ['brute', 'gravedigger', 'bride', 'ripper', 'brood'].includes(monster.type);
        screenPos.y += isBoss ? 16.5 : 12.5;
        screenPos.project(camera);
        if (screenPos.z < 1) {
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
            monster.hpPlate.style.display = 'block';
            monster.hpPlate.style.left = `${x}px`;
            monster.hpPlate.style.top = `${y}px`;
            monster.hpBar.style.width = `${Math.max(0, (monster.health / monster.maxHealth) * 100)}%`;
        } else {
            monster.hpPlate.style.display = 'none';
        }

        if (monster.emerging) {
            const t = Math.min((performance.now() - monster.emergeStart) / monster.emergeDuration, 1);
            monster.mesh.position.lerpVectors(monster.startPosition, monster.emergePosition, 1 - Math.pow(1 - t, 3));
            monster.mesh.lookAt(new THREE.Vector3(pPos.x, monster.mesh.position.y + 4, pPos.z));
            if (t >= 1) monster.emerging = false;
            continue;
        }

        monster.abilityTimer -= delta;
        if (monster.abilityTimer <= 0) {
            monster.abilityTimer = monster.abilityCooldown;
            triggerMonsterAbility(monster);
        }

        if (monster.isUsingAbility && monster.type === 'arachnid') {
            monster.leapProgress += delta * 2.8;
            const step = monster.leapTargetPos.clone().sub(monster.mesh.position);
            step.y = 0;
            moveEntityWithCollision(monster.mesh, step.x, step.z, MONSTER_RADIUS);
            monster.mesh.position.y = Math.sin(monster.leapProgress * Math.PI) * 4.0;
            if (monster.mesh.position.distanceTo(pPos) < 4.5) {
                takeDamage(22);
                monster.isUsingAbility = false;
            } else if (monster.leapProgress >= 1) {
                monster.isUsingAbility = false;
                monster.mesh.position.y = 0;
            }
            monster.mesh.lookAt(new THREE.Vector3(pPos.x, mPos.y + 2, pPos.z));
            continue;
        }

        const dir = new THREE.Vector3(pPos.x - mPos.x, 0, pPos.z - mPos.z);
        const distance = dir.length();
        const stopDist = monster.type === 'spitter' ? 10.0 : 4.6;

        monster.pathTimer -= delta;
        if(monster.pathTimer <= 0) {
            monster.path = findPath(mPos, pPos);
            monster.pathTimer = PATH_RECALC_TIME;
            monster.pathIndex = 0;
        }

        if(distance > stopDist && monster.path.length) {
            const node = monster.path[Math.min(monster.pathIndex, monster.path.length-1)];
            const target = new THREE.Vector3(node[0]*cellSize, 0, node[1]*cellSize);
            const step = target.clone().sub(mPos); step.y = 0;
            if(step.length() < 1.2) monster.pathIndex++;
            else {
                step.normalize();
                moveEntityWithCollision(monster.mesh, step.x*monster.speed*delta, step.z*monster.speed*delta, MONSTER_RADIUS);
            }
        }

        if (distance <= 5.2) {
            monster.attackCooldown -= delta;
            if (monster.attackCooldown <= 0) {
                takeDamage(monster.type === 'brute' ? 26 : (monster.type === 'spitter' ? 15 : 20));
                monster.attackCooldown = 0.85;
            }
        }

        // Animações Procedurais dos Monstros
        const parts = monster.mesh.userData.parts;
        const time = clock.elapsedTime;
        if (monster.type === 'skull') {
            if (parts && parts.armL) {
                const swing = Math.sin(time * 7 + monster.floatOffset) * 0.45;
                parts.armL.rotation.z = 0.25 + swing; parts.armR.rotation.z = -0.25 - swing;
            }
            if (parts && parts.spine) {
                parts.spine.rotation.z = Math.sin(time * 3) * 0.15;
            }
            monster.mesh.position.y = Math.sin(time * 3 + monster.floatOffset) * 0.65;
        } else if (monster.type === 'arachnid') {
            if (parts && parts.legs) {
                parts.legs.forEach((leg, idx) => {
                    leg.group.rotation.x = Math.sin(time * 16 + idx * 0.8) * 0.45;
                });
            }
            monster.mesh.position.y = 0;
        } else if (monster.type === 'brute') {
            monster.mesh.position.y = Math.abs(Math.sin(time * 5)) * 0.35;
        } else if (monster.type === 'watcher') {
            monster.mesh.position.y = Math.sin(time * 2.5 + monster.floatOffset) * 0.8;
            if (parts && parts.satellites) {
                parts.satellites.forEach(s => {
                    s.angle += delta * 1.5;
                    s.mesh.position.set(Math.cos(s.angle)*s.dist, Math.sin(s.angle*1.5)*1.2, Math.sin(s.angle)*s.dist);
                });
            }
        } else if (monster.type === 'spitter') {
            if (parts && parts.belly) {
                const pulse = 1.0 + Math.sin(time * 6) * 0.14;
                parts.belly.scale.set(pulse, pulse, pulse);
            }
            monster.mesh.position.y = Math.sin(time * 4) * 0.2;
        } else if (monster.type === 'butcher') {
            if (parts && parts.cleaverGroup) {
                parts.cleaverGroup.rotation.x = Math.sin(time * 5) * 0.45;
            }
            monster.mesh.position.y = Math.abs(Math.sin(time * 4)) * 0.3;
        } else if (monster.type === 'stalker') {
            if (parts && parts.armL) {
                const clawSwing = Math.sin(time * 8) * 0.35;
                parts.armL.rotation.x = clawSwing;
                parts.armR.rotation.x = -clawSwing;
            }
            monster.mesh.position.y = Math.sin(time * 5) * 0.25;
        } else if (monster.type === 'brood') {
            if (parts && parts.eggSacs) {
                const eggPulse = 1.0 + Math.sin(time * 5) * 0.12;
                parts.eggSacs.forEach(egg => egg.scale.set(eggPulse, eggPulse, eggPulse));
            }
            if (parts && parts.scytheL) {
                parts.scytheL.rotation.z = Math.sin(time * 6) * 0.25;
                parts.scytheR.rotation.z = -Math.sin(time * 6) * 0.25;
            }
            monster.mesh.position.y = 0;
        } else if (monster.type === 'ripper') {
            if (parts && parts.bladeArmL) {
                parts.bladeArmL.rotation.y = Math.sin(time * 7) * 0.35;
                parts.bladeArmR.rotation.y = -Math.sin(time * 7) * 0.35;
            }
            monster.mesh.position.y = Math.sin(time * 6) * 0.3;
        } else if (monster.type === 'gravedigger') {
            if (parts && parts.lanternGroup) {
                parts.lanternGroup.rotation.z = Math.sin(time * 3.5) * 0.35;
                parts.lanternGroup.rotation.x = Math.cos(time * 3.5) * 0.25;
            }
            if (parts && parts.shovelGroup) {
                parts.shovelGroup.rotation.x = Math.sin(time * 4) * 0.2;
            }
            monster.mesh.position.y = Math.abs(Math.sin(time * 3.5)) * 0.4;
        } else if (monster.type === 'bride') {
            if (parts && parts.soulHeart) {
                const heartPulse = 1.0 + Math.sin(time * 6) * 0.25;
                parts.soulHeart.scale.set(heartPulse, heartPulse, heartPulse);
            }
            monster.mesh.position.y = Math.sin(time * 2.8 + monster.floatOffset) * 0.75;
        }

        monster.mesh.lookAt(new THREE.Vector3(pPos.x, mPos.y + 4, pPos.z));
        monster.mesh.rotateY(Math.PI);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
}
