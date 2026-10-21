import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const mount = document.querySelector('#game');
const startScreen = document.querySelector('#startScreen');
const endingScreen = document.querySelector('#endingScreen');
const startButton = document.querySelector('#startButton');
const returnButton = document.querySelector('#returnButton');
const promptEl = document.querySelector('#prompt');
const messageEl = document.querySelector('#message');
const locationLabel = document.querySelector('#locationLabel');
const objectiveText = document.querySelector('#objectiveText');
const findingsEl = document.querySelector('#findings');
const repEl = document.querySelector('#rep');
const endingText = document.querySelector('#endingText');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18201f);
scene.fog = new THREE.FogExp2(0x18201f, 0.035);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'low-power'});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9aaea8, 0x242321, 1.8));
const keyLight = new THREE.DirectionalLight(0xe4e8ce, 1.3); keyLight.position.set(4,8,3); scene.add(keyLight);
const flashlight = new THREE.SpotLight(0xfff2d2, 0, 17, Math.PI/5, .5, 1.2);
flashlight.position.set(0,0,0); flashlight.target.position.set(0,0,-1); camera.add(flashlight); camera.add(flashlight.target); scene.add(camera);

const mat = (color, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const mats = {wall:mat(0x59615c), floor:mat(0x353a36), dark:mat(0x202725), metal:mat(0x68716b,.8,.55), rust:mat(0x71452e), yellow:mat(0xc0a34d), green:mat(0x617b59), paper:mat(0xb9b7a3), crate:mat(0x665744), pipe:mat(0x4a514d,.8,.35)};
const interactables=[]; const colliders=[];
let area='base', running=false, flashlightOn=true, yaw=0, pitch=0, findings=0, rep=0, messageTimer=0, nearObject=null, hasCamera=false, hasMap=false, hasBattery=false, firstPipeSeen=false, introSeen=false;
const keys={};
const player={x:0,y:1.65,z:3.5};

function box(parent, name, pos, size, material, opts={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...pos); mesh.name=name; mesh.castShadow=false; mesh.receiveShadow=false;
  parent.add(mesh);
  if(opts.solid!==false) colliders.push({mesh, box:new THREE.Box3().setFromObject(mesh)});
  return mesh;
}
function labelSprite(text) {
  const c=document.createElement('canvas'); c.width=512;c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle='#111817';ctx.fillRect(0,0,512,128);ctx.fillStyle='#d5e4c8';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,76);
  const tex=new THREE.CanvasTexture(c); const m=new THREE.MeshBasicMaterial({map:tex,transparent:false});
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4,.6),m);
}
function addInteractable(mesh, title, action, description='E — взаимодействовать') { mesh.userData={interactable:true,title,action,description}; interactables.push(mesh); return mesh; }
function clearWorld(){
  for(let i=scene.children.length-1;i>=0;i--){const o=scene.children[i];if(o!==camera && o!==keyLight && o.type!=='HemisphereLight'){scene.remove(o);}}
  // Reattach the flashlight/camera after scene rebuild.
  scene.add(camera); scene.add(keyLight);
  interactables.length=0;colliders.length=0;
}
function makeRoom(parent, w,h,d, wallMat=mats.wall, floorMat=mats.floor) {
  box(parent,'floor',[0,-.12,0],[w,.24,d],floorMat,{solid:false});
  box(parent,'ceiling',[0,h,0],[w,.2,d],mats.dark,{solid:false});
  box(parent,'backwall',[0,h/2,-d/2],[w,h,.2],wallMat);
  box(parent,'leftwall',[-w/2,h/2,0],[.2,h,d],wallMat);
  box(parent,'rightwall',[w/2,h/2,0],[.2,h,d],wallMat);
}
function buildBase(){
  clearWorld(); area='base'; scene.background.set(0x202927);scene.fog=new THREE.FogExp2(0x202927,.025);
  makeRoom(scene,12,4.2,12, mats.wall, mats.floor);
  // Workbench and storage
  box(scene,'workbench',[-3,.95,-2.2],[2.8,.18,1.2],mats.crate);
  for(let x=-4;x<=-2;x+=.7) box(scene,'benchLeg',[x,.45,-1.8],[.12,.9,.12],mats.dark);
  box(scene,'locker',[4,1.2,-3],[1.2,2.4,1],mats.green);
  box(scene,'lockerHandle',[3.45,1.2,-2.47],[.07,.3,.04],mats.metal,{solid:false});
  const gear=box(scene,'gearbox',[-3,1.3,-2.2],[.45,.24,.4],mats.metal,{solid:false});
  addInteractable(gear,'Снаряжение',()=>{hasCamera=true;hasBattery=true;showMessage('Ты проверил снаряжение: фонарь, запасная батарея и старая камера. Болторез? Конечно, забыл.');objectiveText.textContent='Найди карту объекта и выход на вылазку.';});
  const map=box(scene,'map',[0,2.25,-5.82],[2.5,1.2,.08],mats.paper,{solid:false});
  const mapText=labelSprite('ОБЪЕКТ №04 / БУНКЕР');mapText.position.set(0,2.25,-5.75);scene.add(mapText);
  addInteractable(map,'Карта объекта',()=>{hasMap=true;showMessage('На карте отмечен заброшенный бункер №04. На полях кто-то написал: «Если услышишь щелчки — не стой под люком».');objectiveText.textContent='Подойди к двери справа и начни вылазку.';});
  box(scene,'doorframe',[0,1.5,5.82],[2.4,3,.25],mats.dark);
  box(scene,'door',[0,1.45,5.65],[1.9,2.8,.18],mats.rust,{solid:false});
  const handle=box(scene,'doorhandle',[.7,1.45,5.52],[.08,.28,.08],mats.yellow,{solid:false});
  addInteractable(handle,'Дверь на вылазку',()=>{if(!hasMap){showMessage('Сначала изучи карту на стене. Не хочется лезть неизвестно куда.');return;}if(!hasCamera){showMessage('Ты ещё не проверил снаряжение. Лучше подготовиться.');return;}buildBunker();showMessage('Вылазка началась. Не забывай осматриваться.');});
  // Base decorations
  for(let i=0;i<3;i++){box(scene,'shelf',[4,2.8-i*.75,-1.5],[1.1,.08,1.3],mats.crate);}
  const note=box(scene,'note',[4,2.8,-1.5],[.45,.04,.35],mats.paper,{solid:false});
  addInteractable(note,'Записка',()=>showMessage('Записка: «Кто взял мой болторез — верните. Это уже третий раз». Подпись: Саныч.'));
  const chair=box(scene,'chair',[1,0.45,-1],[.7,.12,.7],mats.dark);box(scene,'chairback',[1,.85,-1.3],[.7,.8,.12],mats.dark);
  const poster=box(scene,'poster',[-5,2.4,0],[.05,1.2,1.6],mats.rust,{solid:false});
  addInteractable(poster,'Старый плакат',()=>showMessage('На плакате выцветшая надпись: «НЕ ЛЕЗЬ, ЕСЛИ НЕ ЗНАЕШЬ, КАК ВЫЛЕЗАТЬ». Кто-то пририсовал смешного человечка.'));
  player.x=0;player.y=1.65;player.z=3.3;yaw=0;pitch=0;syncCamera();locationLabel.textContent='БАЗА';objectiveText.textContent=hasMap?'Подойди к двери справа и начни вылазку.':'Осмотрись на базе: проверь снаряжение и найди карту.';
}
function buildBunker(){
  clearWorld();area='bunker';scene.background.set(0x111817);scene.fog=new THREE.FogExp2(0x111817,.045);
  // Main corridor, rooms and doorway
  makeRoom(scene,7,3.6,34,mats.dark,mats.floor);
  // Corridor side supports
  for(let z=-15;z<=15;z+=3){box(scene,'supportL',[-3.35,1.8,z],[.3,3.6,.3],mats.pipe);box(scene,'supportR',[3.35,1.8,z],[.3,3.6,.3],mats.pipe);}
  // pipes along ceiling
  for(let x=-1.8;x<=1.8;x+=1.8) box(scene,'pipe',[x,3.05,0],[.18,.18,31],mats.rust);
  // crates
  box(scene,'crateA',[-1.7,.55,-5],[1.1,1.1,1.1],mats.crate);
  box(scene,'crateB',[1.8,.45,-9],[.9,.9,.9],mats.crate);
  // strange wall message
  const scrawl=box(scene,'scrawl',[3.78,1.9,-8],[.04,1.1,2.1],mats.rust,{solid:false});
  addInteractable(scrawl,'Надпись на стене',()=>showMessage('На стене нацарапано: «Я УЖЕ ЗДЕСЬ БЫЛ». Буквы выглядят старыми. Почему-то от этой фразы неприятно.'));
  // collectible evidence
  const cameraItem=box(scene,'cameraItem',[-1.7,1.25,-5],[.42,.3,.28],mats.metal,{solid:false});
  addInteractable(cameraItem,'Старая камера',()=>{findings++;rep+=5;updateStats();cameraItem.visible=false;showMessage('Находка: старая камера с плёнкой. Может, на ней что-то осталось. +5 репутации.');objectiveText.textContent='Осмотри бункер и найди ещё что-нибудь интересное.';});
  const helmet=box(scene,'helmet',[1.8,1,-9],[.48,.24,.42],mats.yellow,{solid:false});
  addInteractable(helmet,'Каска',()=>{findings++;rep+=2;updateStats();helmet.visible=false;showMessage('Находка: старая каска. Внутри написано «Витёк». +2 репутации.');});
  // Death-pipe teaser, not a real-world navigational representation
  box(scene,'pipeframe',[-1.5,1.3,-13.5],[1.8,2.6,.18],mats.rust);
  const pipeMouth=box(scene,'pipeMouth',[-1.5,1.4,-13.35],[1.25,1.8,.12],mats.dark,{solid:false});
  addInteractable(pipeMouth,'Подозрительный вентиляционный проём',()=>{
    if(!firstPipeSeen){firstPipeSeen=true;showMessage('Персонаж: «Хм… такое чувство, будто я здесь уже был. Хотя я первый раз в этом бункере… Де-жа-вю, наверное». Проём выглядит слишком узким. В первый билд лезть туда нельзя.');}
    else showMessage('Ты снова смотришь на проём. Внутри что-то тихо щёлкает. Решение о трубе смерти пока оставлено для будущего обновления.');
  });
  const exit=box(scene,'exitDoor',[0,1.3,16.7],[2,2.6,.15],mats.green,{solid:false});
  addInteractable(exit,'Выход из бункера',()=>{
    endingText.textContent=`Ты вернулся с ${findings} находками. Репутация: ${rep}. Пока это короткий тестовый маршрут — в следующих билдах появятся новые объекты, NPC и случайные события.`;
    endingScreen.classList.remove('hidden');document.exitPointerLock?.();running=false;
  });
  // corridor lamps, one broken
  for(const z of [-3,3,9]){const bulb=new THREE.PointLight(0xc9d6a6,z===3?1.2:0.6,5);bulb.position.set(0,3.1,z);scene.add(bulb);}
  player.x=0;player.y=1.65;player.z=13.5;yaw=0;pitch=0;syncCamera();locationLabel.textContent='ОБЪЕКТ №04';objectiveText.textContent='Исследуй бункер: осмотри находки и найди выход обратно.';
}
function updateStats(){findingsEl.textContent=findings;repEl.textContent=rep;}
function syncCamera(){camera.position.set(player.x,player.y,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
function showMessage(text){messageEl.textContent=text;messageEl.classList.remove('hidden');messageTimer=5.5;}
function isBlocked(x,z){
  const p=new THREE.Vector3(x,player.y,z);
  for(const c of colliders){if(!c.mesh.visible)continue;const b=c.box.clone();b.min.y=-1;b.max.y=3.8;if(p.x>b.min.x-.25&&p.x<b.max.x+.25&&p.z>b.min.z-.25&&p.z<b.max.z+.25){if(c.mesh.name==='door'&&area==='base')continue;return true;}}
  return false;
}
function findTarget(){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(interactables.filter(o=>o.visible),false);if(hits.length&&hits[0].distance<3.2)return hits[0].object;return null;}
function interact(){if(!nearObject)return;nearObject.userData.action();}
function onKeyDown(e){
  const k=(e.key||'').toLowerCase();
  const code=(e.code||'').toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k)) e.preventDefault();
  keys[k]=true;
  if(code==='keyw') keys.w=true; if(code==='keya') keys.a=true; if(code==='keys') keys.s=true; if(code==='keyd') keys.d=true;
  if(code==='shiftleft'||code==='shiftright') keys.shift=true;
  if((k==='e'||code==='keye')&&running){e.preventDefault();interact();}
  if((k==='f'||code==='keyf')&&running){e.preventDefault();flashlightOn=!flashlightOn;flashlight.intensity=flashlightOn?42:0;showMessage(flashlightOn?'Фонарь включён.':'Фонарь выключен.');}
  if(k==='escape'){promptEl.classList.add('hidden');}
}
function onKeyUp(e){const k=(e.key||'').toLowerCase();const code=(e.code||'').toLowerCase();keys[k]=false;if(['keyw','keya','keys','keyd'].includes(code))keys[code.slice(3)]=false;if(code==='shiftleft'||code==='shiftright')keys.shift=false;}
function onMouseMove(e){if(!running||document.pointerLockElement!==renderer.domElement)return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.45,Math.min(1.45,pitch));syncCamera();}
renderer.domElement.addEventListener('click',()=>{if(running&&document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();});
startButton.addEventListener('click',()=>{startScreen.classList.add('hidden');running=true;buildBase();renderer.domElement.requestPointerLock?.();if(!introSeen){showMessage('База Digger Station. Сначала подготовься: проверь снаряжение, изучи карту, затем выходи.');introSeen=true;}});
returnButton.addEventListener('click',()=>{endingScreen.classList.add('hidden');buildBase();running=true;renderer.domElement.requestPointerLock?.();showMessage('Снова на базе. Находки и репутация сохранены.');});
document.addEventListener('keydown',onKeyDown,{passive:false});document.addEventListener('keyup',onKeyUp);addEventListener('mousemove',onMouseMove);
// Keep keyboard controls available even after the pointer lock is released.
renderer.domElement.tabIndex=0;renderer.domElement.style.outline='none';
startButton.addEventListener('click',()=>renderer.domElement.focus());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// Initial world for the scene behind the title card.
buildBase();
const clock=new THREE.Clock();
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);
  if(running){const forward=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);const strafe=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);if(forward||strafe){const speed=(keys.shift?4.3:2.7)*dt;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed;const dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*strafe)*speed;const nx=player.x+dx,nz=player.z+dz;if(!isBlocked(nx,player.z))player.x=nx;if(!isBlocked(player.x,nz))player.z=nz;syncCamera();}
    nearObject=findTarget();if(nearObject){promptEl.textContent=`E — ${nearObject.userData.title}`;promptEl.classList.remove('hidden');}else promptEl.classList.add('hidden');
    flashlight.position.copy(camera.position);flashlight.target.position.copy(camera.position).add(new THREE.Vector3(0,0,-1).applyEuler(camera.rotation));
    if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)messageEl.classList.add('hidden');}
  }
  renderer.render(scene,camera);
}
flashlight.intensity=42;loop();
