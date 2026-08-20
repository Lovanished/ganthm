const $=s=>document.querySelector(s);const listEl=$('#songList'),playBtn=$('#playSelected'),statusEl=$('#loadStatus'),resultEl=$('#result');let songs=[],selected=null,chart=null,audio=new Audio();let running=false,active=[],score=0,combo=0,maxCombo=0,counts={Perfect:0,Great:0,Good:0,Miss:0};

// 레인 수별 키 배치. 채보 json에 "lanes":6 또는 8을 지정하면 해당 배치가 적용됨 (기본 4).
const KEY_SETS={4:['d','f','j','k'],6:['d','f','g','j','k','l'],8:['z','d','f','g','j','k','l','/']};
let laneCount=4,LANES=KEY_SETS[4],LANE_KEYS={d:0,f:1,j:2,k:3};
function setupLanes(n){
  laneCount=KEY_SETS[n]?n:4;
  LANES=KEY_SETS[laneCount];
  LANE_KEYS={};LANES.forEach((k,i)=>LANE_KEYS[k]=i);
  document.documentElement.style.setProperty('--laneCount',laneCount);
  document.documentElement.style.setProperty('--laneAreaWidth',(laneCount<=4?64:laneCount<=6?80:94)+'%');
  const lanesEl=$('#lanes');lanesEl.innerHTML='';for(let i=0;i<laneCount;i++){const d=document.createElement('div');d.className='lane';d.dataset.lane=i;d.style.left=(i*100/laneCount)+'%';d.addEventListener('pointerdown',onLanePointerDown);lanesEl.appendChild(d)}
  const keysEl=$('#keys');keysEl.innerHTML='';LANES.forEach((k,i)=>{const kb=document.createElement('kbd');kb.textContent=k.toUpperCase();kb.dataset.lane=i;kb.addEventListener('pointerdown',onLanePointerDown);keysEl.appendChild(kb)});
}
setupLanes(4);

// ===== 노트 입력 이펙트 / 사운드 설정 =====
let settings={effects:true,sound:true};
const fxToggle=$('#fxToggle'),soundToggle=$('#soundToggle');
fxToggle&&fxToggle.addEventListener('change',()=>{settings.effects=fxToggle.checked;if(!settings.effects)document.querySelectorAll('.lane.lit,kbd.lit').forEach(el=>el.classList.remove('lit'))});
soundToggle&&soundToggle.addEventListener('change',()=>{settings.sound=soundToggle.checked});

const HIT_SOUND_SRC='assets/note1.mp3';
const hitSoundPool=Array.from({length:6},()=>new Audio(HIT_SOUND_SRC));
let hitSoundIdx=0;
function playHitSound(){
  if(!settings.sound)return;
  const a=hitSoundPool[hitSoundIdx];
  hitSoundIdx=(hitSoundIdx+1)%hitSoundPool.length;
  a.currentTime=0;
  a.play().catch(()=>{});
}

// 레인에 불 켜기/끄기 (키를 누르고 있는 동안, 또는 터치 중)
function setLaneLit(lane,on){
  if(on&&!settings.effects)return;
  document.querySelectorAll(`.lane[data-lane="${lane}"], kbd[data-lane="${lane}"]`).forEach(el=>el.classList.toggle('lit',on));
}
// Perfect 판정 시 히트라인 위치에 터지는 이펙트
function spawnPerfectEffect(lane){
  if(!settings.effects)return;
  const area=document.querySelector('.laneArea');
  if(!area)return;
  const fx=document.createElement('div');
  fx.className='perfectFx';
  fx.style.left=((lane+0.5)*100/laneCount)+'%';
  area.appendChild(fx);
  fx.addEventListener('animationend',()=>fx.remove());
}

// 트랙 양옆 장식: 평소엔 idle 이미지, D/F/J/K 입력에 맞춰 방향 이미지로 반응. 실제 파일명/경로에 맞게 수정하세요.
const LANE_IMG={d:'assets/left.png',f:'assets/down.png',j:'assets/up.png',k:'assets/right.png'};
const LANE_DIR={d:'left',f:'down',j:'up',k:'right'};
const IDLE_IMG='assets/idle.png';
const decoLeftImg=$('#decoLeftImg'),decoRightImg=$('#decoRightImg');
const FRAME_MS=90; // 입력 반응 애니메이션의 기준 "프레임" 길이
document.documentElement.style.setProperty('--inputFrame',(FRAME_MS*2)+'ms');
let recentPresses=[],decoCycleTimer=null,decoIdleTimer=null,decoCycleIdx=0;

// 노트 낙하 속도 (px/sec). 슬라이더로 조절하거나 채보 json의 "speed" 필드로 곡별 기본값을 줄 수 있음.
const speedRange=$('#speedRange'),speedValueEl=$('#speedValue');
let speed=speedRange?parseInt(speedRange.value,10):430;
speedRange&&speedRange.addEventListener('input',()=>{speed=parseInt(speedRange.value,10);speedValueEl.textContent=speed;});

// ===== 채보 작성 모드 상태 =====
let editMode=false,editInitialized=false,editHistory=[];
const editHud=$('#editHud'),editStatusEl=$('#editStatus'),editTimeEl=$('#editTime'),editCountEl=$('#editCount'),snapSelect=$('#snapDivision');

const modeListEl=$('#modeList');let selectedMode=null;

// ===== 곡 선택 화면 슬라이드 네비게이션: 설정 ← 홈 → 곡선택 → 모드선택 =====
const SLIDES=['settings','home','songs','modes'];
const slideTrack=$('#slideTrack');
let slideIndex=1;
function navigateTo(name){
  const idx=SLIDES.indexOf(name);
  if(idx<0)return;
  slideIndex=idx;
  slideTrack.style.transform=`translateX(-${slideIndex*25}%)`;
}
slideTrack&&slideTrack.addEventListener('click',e=>{
  const btn=e.target.closest('[data-nav]');
  if(btn)navigateTo(btn.dataset.nav);
});
const selectIdleImg=$('#selectIdleImg');
if(selectIdleImg)selectIdleImg.src=IDLE_IMG;

function starsFor(level,max=10){const n=Math.max(0,Math.min(max,Math.round(level||0)));return '★'.repeat(n)+'☆'.repeat(max-n)}

async function init(){try{const r=await fetch('./charts/index.json',{cache:'no-store'});if(!r.ok)throw Error('charts/index.json '+r.status);songs=await r.json();renderSongs();}catch(e){statusEl.textContent='곡 목록을 불러오지 못했습니다: '+e.message;}}
function renderSongs(){listEl.innerHTML='';songs.forEach((s,i)=>{const d=document.createElement('div');d.className='song';const badge=s.charts?`${s.charts.length}개 모드`:(s.difficulty||'NORMAL');const diffLabel=s.difficulty?`<p class="diffLabel">${esc(s.difficulty)}</p>`:'';d.innerHTML=`<div><h2>${esc(s.title||'Untitled')}</h2><p>${esc(s.artist||'')}</p>${diffLabel}</div><div class="meta">${esc(badge)}</div>`;d.onclick=()=>selectSong(i,d);listEl.appendChild(d)});if(songs.length)selectSong(0,listEl.firstChild,false)}
function selectSong(i,el,autoNav=true){document.querySelectorAll('.song').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');selected=i;selectedMode=null;
const s=songs[i];
if(Array.isArray(s.charts)&&s.charts.length){
  renderModes(s.charts);
  if(autoNav)navigateTo('modes');
  playBtn.disabled=true;
  statusEl.textContent='선택됨: '+(s.title||'Untitled')+' — 모드를 선택하세요';
}else{
  modeListEl.innerHTML='';
  playBtn.disabled=false;
  statusEl.textContent='선택됨: '+(s.title||'Untitled');
}}
function renderModes(modes){
  modeListEl.innerHTML='<div class="modeHint">모드 선택</div>';
  modes.forEach((m,i)=>{
    const b=document.createElement('div');
    b.className='mode';
    const label=document.createElement('div');label.textContent=m.name||m.difficulty||('모드 '+(i+1));b.appendChild(label);
    const starsText=m.stars||(m.level!=null?starsFor(m.level):null);
    if(starsText){const st=document.createElement('div');st.className='stars';st.textContent=starsText;b.appendChild(st)}
    b.onclick=()=>selectMode(i,b);
    modeListEl.appendChild(b);
  });
}
function selectMode(i,el){
  modeListEl.querySelectorAll('.mode').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  selectedMode=i;
  playBtn.disabled=false;
  const s=songs[selected],m=s.charts[i];
  statusEl.textContent='선택됨: '+(s.title||'Untitled')+' — '+(m.name||m.difficulty||('모드 '+(i+1)));
}
async function loadChart(){
  const s=songs[selected];
  const chartPath=Array.isArray(s.charts)?s.charts[selectedMode].chart:s.chart;
  const r=await fetch(chartPath,{cache:'no-store'});if(!r.ok)throw Error('채보 파일 '+r.status);chart=await r.json();const base = new URL(".", window.location.href);
audio.src = new URL(chart.audio, base).href;
audio.preload = "auto";
audio.load();
audio.onerror = () => {
  running = false;
  const code = audio.error?.code ?? "unknown";
  resultEl.innerHTML = `<div><b>음원 로딩 실패</b><br><br>파일 경로 또는 음원 형식을 확인하세요.<br>경로: ${audio.src}<br>MediaError: ${code}<br><br><button onclick="resultEl.classList.add('hidden')">CLOSE</button></div>`;
  resultEl.classList.remove("hidden");
};
if(chart.speed&&speedRange){speed=chart.speed;speedRange.value=chart.speed;speedValueEl.textContent=chart.speed}
setupLanes(chart.lanes||4);
const modeLabel=Array.isArray(s.charts)?(' — '+(s.charts[selectedMode].name||s.charts[selectedMode].difficulty||'')):'';
$('#songTitle').textContent=(chart.title||s.title||'')+modeLabel}
playBtn.onclick=async()=>{try{await loadChart();reset();$('#selectScreen').classList.add('hidden');$('#gameScreen').classList.remove('hidden');try {
  await audio.play();
} catch (err) {
  running = false;
  resultEl.innerHTML = `<div><b>재생 실패</b><br><br>${err.message}<br><br>음원이 브라우저에서 지원되는 형식인지 확인하세요.<br><button onclick="resultEl.classList.add('hidden')">CLOSE</button></div>`;
  resultEl.classList.remove("hidden");
  return;
}
running=true;requestAnimationFrame(frame)}catch(e){statusEl.textContent='실행 실패: '+e.message;}};
$('#backBtn').onclick=()=>{running=false;audio.pause();audio.currentTime=0;resetDecoIdle(chart&&chart.bpm);exitEditModeSilently();$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden');navigateTo('songs')};
function reset(){score=combo=maxCombo=0;counts={Perfect:0,Great:0,Good:0,Miss:0};$('#result').classList.add('hidden');$('#notes').innerHTML='';active=(chart.notes||[]).map((n,i)=>({...n,i,done:false,el:null}));editMode=false;editInitialized=false;editHistory=[];editHud.classList.add('hidden');document.body.classList.remove('editing');resetDecoIdle(chart.bpm);updateHud();$('#judge').textContent=''}
function updateHud(){$('#score').textContent='SCORE '+score;$('#combo').textContent='COMBO '+combo}
function spawn(now){for(const n of active){if(n.el||n.done)continue;if(n.time-now<3){const e=document.createElement('div');e.className='note'+(n.fromEdit?' editNote':'');e.style.left=(n.lane*100/laneCount)+'%';$('#notes').appendChild(e);n.el=e}}}
function frame(){if(!running)return;const now=audio.currentTime;spawn(now);const h=$('#game').clientHeight,hit=h-88;for(const n of active){if(!n.el||n.done)continue;const d=n.time-now;n.el.style.top=(hit-d*speed-11)+'px';if(!editMode&&d<-.23)judge(n,'Miss')}if(editMode)updateEditHud();requestAnimationFrame(frame);}
function judge(n,type){if(n.done)return;n.done=true;if(n.el)n.el.remove();counts[type]++;if(type==='Miss')combo=0;else{combo++;maxCombo=Math.max(maxCombo,combo);score+=type==='Perfect'?1000:type==='Great'?700:400;playHitSound();if(type==='Perfect')spawnPerfectEffect(n.lane)}$('#judge').textContent=type;updateHud();if(active.every(x=>x.done))finish()}
function finish(){running=false;resetDecoIdle(chart&&chart.bpm);$('#result').innerHTML=`<div class="resultBox"><div><b>RESULT</b><br><br>SCORE ${score}<br>MAX COMBO ${maxCombo}<br>Perfect ${counts.Perfect} / Great ${counts.Great} / Good ${counts.Good} / Miss ${counts.Miss}<br><br><button id="closeResult">SONG SELECT</button></div></div>`;$('#result').classList.remove('hidden');$('#closeResult').onclick=()=>{$('#result').classList.add('hidden');$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden');navigateTo('songs')}}

// ===== 트랙 양옆 입력 반응형 장식 =====
// - 평소(idle): idle.png가 bpm 한 박자 동안 4프레임으로 끊어서 위아래 스쿼시-스트레치
// - D/F/J/K 입력: 해당 방향 이미지로 바뀌며 2프레임 주기로 그 방향으로 늘었다 줄었다 반복
// - 동시에 여러 입력: 해당 이미지들을 2프레임 간격으로 순서대로 빠르게 순환
// - 3프레임(약 270ms) 이상 입력이 없으면 idle로 복귀
function registerDecoInput(lane){
  if(!decoLeftImg||!decoRightImg)return;
  const now=performance.now();
  recentPresses=recentPresses.filter(p=>now-p.t<FRAME_MS*3).concat({lane,t:now});
  const distinct=[...new Set(recentPresses.map(p=>p.lane))];
  applyDecoActive(distinct);
  clearTimeout(decoIdleTimer);
  decoIdleTimer=setTimeout(goDecoIdle,FRAME_MS*3);
}
function applyDecoActive(lanes){
  clearInterval(decoCycleTimer);decoCycleTimer=null;
  setDecoIdleClass(false);
  if(lanes.length<=1){
    setDecoImg(LANE_IMG[lanes[0]]);
    setDecoPulse(LANE_DIR[lanes[0]]);
  }else{
    decoCycleIdx=0;
    const step=()=>{const lane=lanes[decoCycleIdx%lanes.length];setDecoImg(LANE_IMG[lane]);setDecoPulse(LANE_DIR[lane]);decoCycleIdx++};
    step();
    decoCycleTimer=setInterval(step,FRAME_MS*2);
  }
}
function setDecoImg(src){decoLeftImg.src=src;decoRightImg.src=src}
function setDecoPulse(dir){[decoLeftImg,decoRightImg].forEach(img=>{img.classList.remove('pulse-left','pulse-right','pulse-up','pulse-down');void img.offsetWidth;img.classList.add('pulse-'+dir)})}
function setDecoIdleClass(idle){[decoLeftImg,decoRightImg].forEach(img=>{img.classList.toggle('idleWiggle',idle);if(idle)img.classList.remove('pulse-left','pulse-right','pulse-up','pulse-down')})}
function goDecoIdle(){clearInterval(decoCycleTimer);decoCycleTimer=null;recentPresses=[];if(!decoLeftImg||!decoRightImg)return;setDecoImg(IDLE_IMG);setDecoIdleClass(true)}
function resetDecoIdle(bpm){clearInterval(decoCycleTimer);decoCycleTimer=null;clearTimeout(decoIdleTimer);decoIdleTimer=null;recentPresses=[];document.documentElement.style.setProperty('--beat',(60/(bpm||120))+'s');if(!decoLeftImg||!decoRightImg)return;setDecoImg(IDLE_IMG);setDecoIdleClass(true)}

// ===== 채보 작성 모드 =====
function beatStep(){const bpm=(chart&&chart.bpm)||120;const div=parseInt(snapSelect?.value||4,10);return (60/bpm)/div}
function snapTime(t){const offset=(chart&&chart.offset)||0;const step=beatStep();return Math.max(0,offset+Math.round((t-offset)/step)*step)}
function fmtTime(t){if(!isFinite(t)||t<0)return'0:00';const m=Math.floor(t/60),s=(t%60).toFixed(2).padStart(5,'0');return m+':'+s}
function updateEditHud(){editTimeEl.textContent=fmtTime(audio.currentTime)+' / '+fmtTime(audio.duration||0);editStatusEl.textContent=audio.paused?'PAUSED':'PLAYING';editCountEl.textContent=active.length+' notes'}

function toggleEditMode(){
  if(!chart||$('#gameScreen').classList.contains('hidden'))return;
  editMode=!editMode;
  if(editMode){
    if(!editInitialized){active=(chart.notes||[]).map((n,i)=>({...n,i,done:false,el:null}));editInitialized=true}
    $('#notes').innerHTML='';active.forEach(n=>n.el=null);
    audio.pause();
    document.body.classList.add('editing');
    editHud.classList.remove('hidden');
  }else{
    const now=audio.currentTime;
    active.forEach(n=>{if(n.time<now-.23)n.done=true});
    score=combo=maxCombo=0;counts={Perfect:0,Great:0,Good:0,Miss:0};updateHud();
    editHud.classList.add('hidden');
    document.body.classList.remove('editing');
    if(audio.paused)audio.play().catch(()=>{});
  }
  updateEditHud();
}
function exitEditModeSilently(){editMode=false;editHud.classList.add('hidden');document.body.classList.remove('editing')}

function placeNote(lane){
  const t=snapTime(audio.currentTime);
  const note={time:t,lane,i:active.length,done:false,el:null,fromEdit:true};
  active.push(note);editHistory.push(note);
  spawn(audio.currentTime);
  updateEditHud();
}
function undoLastNote(){
  const n=editHistory.pop();if(!n)return;
  const idx=active.indexOf(n);if(idx>-1)active.splice(idx,1);
  if(n.el)n.el.remove();
  updateEditHud();
}
function togglePlayPause(){if(audio.paused)audio.play().catch(()=>{});else audio.pause();updateEditHud()}
function seek(delta){audio.currentTime=Math.min(Math.max(0,audio.currentTime+delta),audio.duration||1e9);updateEditHud()}
function exportChart(){
  const notesOut=active.map(({time,lane})=>({time:Math.round(time*1000)/1000,lane})).sort((a,b)=>a.time-b.time);
  const s=songs[selected]||{};
  const out={title:chart.title||s.title||'Untitled',artist:chart.artist||s.artist||'',bpm:chart.bpm||120,offset:chart.offset||0,audio:chart.audio,difficulty:chart.difficulty||s.difficulty||'NORMAL',lanes:laneCount,notes:notesOut};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=(out.title||'chart').replace(/[^\w\-]+/g,'_')+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('#editUndoBtn')&&($('#editUndoBtn').onclick=undoLastNote);
$('#editSaveBtn')&&($('#editSaveBtn').onclick=exportChart);

// 레인 입력 처리 (키보드 입력과 터치/클릭 입력이 공유). lane은 0부터 시작하는 레인 인덱스.
function handleLaneInput(lane){
  if(lane===undefined||lane===null||!chart||$('#gameScreen').classList.contains('hidden'))return;
  const keyLetter=LANES[lane];
  if(keyLetter&&LANE_IMG[keyLetter])registerDecoInput(keyLetter);
  if(editMode){placeNote(lane);return}
  if(!running)return;
  const now=audio.currentTime;
  const c=active.filter(n=>!n.done&&n.lane===lane).map(n=>({n,err:Math.abs(n.time-now)})).sort((a,b)=>a.err-b.err)[0];
  if(!c)return;
  if(c.err<=.05)judge(c.n,'Perfect');else if(c.err<=.10)judge(c.n,'Great');else if(c.err<=.18)judge(c.n,'Good')
}

function handleEditKey(e){
  const k=e.key.toLowerCase();
  if(e.code==='Backspace'){e.preventDefault();undoLastNote();return}
  if(k==='s'){e.preventDefault();exportChart();return}
  if(e.code==='Enter'){e.preventDefault();togglePlayPause();return}
  if(e.code==='ArrowLeft'){e.preventDefault();seek(e.shiftKey?-1:-beatStep());return}
  if(e.code==='ArrowRight'){e.preventDefault();seek(e.shiftKey?1:beatStep());return}
  const lane=LANE_KEYS[k];
  if(lane===undefined)return;
  handleLaneInput(lane);
}

function keydown(e){
  if(document.activeElement&&['SELECT','INPUT'].includes(document.activeElement.tagName))return;
  if(e.code==='Space'&&chart&&!$('#gameScreen').classList.contains('hidden')){e.preventDefault();toggleEditMode();return}
  const key=e.key.toLowerCase();
  const gameVisible=chart&&!$('#gameScreen').classList.contains('hidden');
  if(gameVisible&&LANE_KEYS[key]!==undefined)setLaneLit(LANE_KEYS[key],true);
  if(editMode){handleEditKey(e);return}
  if(!running)return;
  const lane=LANE_KEYS[key];if(lane===undefined)return;
  handleLaneInput(lane);
}
function keyup(e){
  const key=e.key.toLowerCase();
  const lane=LANE_KEYS[key];
  if(lane!==undefined)setLaneLit(lane,false);
}
// 레인 터치/클릭 입력: 손가락이나 마우스로 직접 레인을 눌러도 키보드와 동일하게 동작 (멀티터치 지원)
const laneByPointer=new Map();
function onLanePointerDown(e){
  e.preventDefault();
  const lane=parseInt(e.currentTarget.dataset.lane,10);
  laneByPointer.set(e.pointerId,lane);
  setLaneLit(lane,true);
  handleLaneInput(lane);
}
function releasePointerLane(e){
  const lane=laneByPointer.get(e.pointerId);
  if(lane!==undefined){setLaneLit(lane,false);laneByPointer.delete(e.pointerId)}
}
document.addEventListener('pointerup',releasePointerLane);
document.addEventListener('pointercancel',releasePointerLane);
document.addEventListener('keydown',keydown);
document.addEventListener('keyup',keyup);
function esc(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}init();
