const $=s=>document.querySelector(s);const listEl=$('#songList'),playBtn=$('#playSelected'),statusEl=$('#loadStatus'),resultEl=$('#result');let songs=[],selected=null,chart=null,audio=new Audio();let running=false,active=[],score=0,combo=0,maxCombo=0,counts={Perfect:0,Great:0,Good:0,Miss:0};

// 트랙 양옆에 표시할 이미지 4장 (BPM마다 순서대로 순환). 실제 파일명/경로에 맞게 수정하세요.
const DECO_IMAGES=['assets/deco1.png','assets/deco2.png','assets/deco3.png','assets/deco4.png'];
const decoLeftImg=$('#decoLeftImg'),decoRightImg=$('#decoRightImg');
let decoTimer=null,decoIndex=0;

// 노트 낙하 속도 (px/sec). 슬라이더로 조절하거나 채보 json의 "speed" 필드로 곡별 기본값을 줄 수 있음.
const speedRange=$('#speedRange'),speedValueEl=$('#speedValue');
let speed=speedRange?parseInt(speedRange.value,10):430;
speedRange&&speedRange.addEventListener('input',()=>{speed=parseInt(speedRange.value,10);speedValueEl.textContent=speed;});

// ===== 채보 작성 모드 상태 =====
let editMode=false,editInitialized=false,editHistory=[];
const editHud=$('#editHud'),editStatusEl=$('#editStatus'),editTimeEl=$('#editTime'),editCountEl=$('#editCount'),snapSelect=$('#snapDivision');

async function init(){try{const r=await fetch('./charts/index.json',{cache:'no-store'});if(!r.ok)throw Error('charts/index.json '+r.status);songs=await r.json();renderSongs();}catch(e){statusEl.textContent='곡 목록을 불러오지 못했습니다: '+e.message;}}
function renderSongs(){listEl.innerHTML='';songs.forEach((s,i)=>{const d=document.createElement('div');d.className='song';d.innerHTML=`<div><h2>${esc(s.title||'Untitled')}</h2><p>${esc(s.artist||'')}</p></div><div class="meta">${esc(s.difficulty||'NORMAL')}</div>`;d.onclick=()=>selectSong(i,d);listEl.appendChild(d)});if(songs.length)selectSong(0,listEl.firstChild)}
function selectSong(i,el){document.querySelectorAll('.song').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');selected=i;playBtn.disabled=false;statusEl.textContent='선택됨: '+(songs[i].title||'Untitled')}
async function loadChart(){const s=songs[selected];const r=await fetch(s.chart,{cache:'no-store'});if(!r.ok)throw Error('채보 파일 '+r.status);chart=await r.json();const base = new URL(".", window.location.href);
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
$('#songTitle').textContent=chart.title||s.title||''}
playBtn.onclick=async()=>{try{await loadChart();reset();$('#selectScreen').classList.add('hidden');$('#gameScreen').classList.remove('hidden');try {
  await audio.play();
} catch (err) {
  running = false;
  resultEl.innerHTML = `<div><b>재생 실패</b><br><br>${err.message}<br><br>음원이 브라우저에서 지원되는 형식인지 확인하세요.<br><button onclick="resultEl.classList.add('hidden')">CLOSE</button></div>`;
  resultEl.classList.remove("hidden");
  return;
}
running=true;startDeco(chart.bpm);requestAnimationFrame(frame)}catch(e){statusEl.textContent='실행 실패: '+e.message;}};
$('#backBtn').onclick=()=>{running=false;audio.pause();audio.currentTime=0;stopDeco();exitEditModeSilently();$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden')};
function reset(){score=combo=maxCombo=0;counts={Perfect:0,Great:0,Good:0,Miss:0};$('#result').classList.add('hidden');$('#notes').innerHTML='';active=(chart.notes||[]).map((n,i)=>({...n,i,done:false,el:null}));editMode=false;editInitialized=false;editHistory=[];editHud.classList.add('hidden');document.body.classList.remove('editing');updateHud();$('#judge').textContent=''}
function updateHud(){$('#score').textContent='SCORE '+score;$('#combo').textContent='COMBO '+combo}
function spawn(now){for(const n of active){if(n.el||n.done)continue;if(n.time-now<3){const e=document.createElement('div');e.className='note'+(n.fromEdit?' editNote':'');e.style.left=(n.lane*25)+'%';$('#notes').appendChild(e);n.el=e}}}
function frame(){if(!running)return;const now=audio.currentTime;spawn(now);const h=$('#game').clientHeight,hit=h-88;for(const n of active){if(!n.el||n.done)continue;const d=n.time-now;n.el.style.top=(hit-d*speed-11)+'px';if(!editMode&&d<-.23)judge(n,'Miss')}if(editMode)updateEditHud();requestAnimationFrame(frame);}
function judge(n,type){if(n.done)return;n.done=true;if(n.el)n.el.remove();counts[type]++;if(type==='Miss')combo=0;else{combo++;maxCombo=Math.max(maxCombo,combo);score+=type==='Perfect'?1000:type==='Great'?700:400}$('#judge').textContent=type;updateHud();if(active.every(x=>x.done))finish()}
function finish(){running=false;stopDeco();$('#result').innerHTML=`<div class="resultBox"><div><b>RESULT</b><br><br>SCORE ${score}<br>MAX COMBO ${maxCombo}<br>Perfect ${counts.Perfect} / Great ${counts.Great} / Good ${counts.Good} / Miss ${counts.Miss}<br><br><button id="closeResult">SONG SELECT</button></div></div>`;$('#result').classList.remove('hidden');$('#closeResult').onclick=()=>{$('#result').classList.add('hidden');$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden')}}

// BPM에 맞춰 사이드 장식 이미지를 순환시키고, CSS의 headbang 애니메이션 주기(--beat)를 같은 박자로 맞춤
function startDeco(bpm){
  stopDeco();
  if(!decoLeftImg||!decoRightImg)return;
  const beatSec=60/(bpm||120);
  document.documentElement.style.setProperty('--beat',beatSec+'s');
  decoIndex=0;setDecoImages();
  decoTimer=setInterval(()=>{decoIndex=(decoIndex+1)%DECO_IMAGES.length;setDecoImages()},beatSec*1000);
}
function setDecoImages(){decoLeftImg.src=DECO_IMAGES[decoIndex];decoRightImg.src=DECO_IMAGES[(decoIndex+2)%DECO_IMAGES.length];}
function stopDeco(){if(decoTimer){clearInterval(decoTimer);decoTimer=null}}

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
  const out={title:chart.title||s.title||'Untitled',artist:chart.artist||s.artist||'',bpm:chart.bpm||120,offset:chart.offset||0,audio:chart.audio,difficulty:chart.difficulty||s.difficulty||'NORMAL',notes:notesOut};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=(out.title||'chart').replace(/[^\w\-]+/g,'_')+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('#editUndoBtn')&&($('#editUndoBtn').onclick=undoLastNote);
$('#editSaveBtn')&&($('#editSaveBtn').onclick=exportChart);

function handleEditKey(e){
  const k=e.key.toLowerCase();
  if(k==='z'){e.preventDefault();undoLastNote();return}
  if(k==='s'){e.preventDefault();exportChart();return}
  if(e.code==='Enter'){e.preventDefault();togglePlayPause();return}
  if(e.code==='ArrowLeft'){e.preventDefault();seek(e.shiftKey?-1:-beatStep());return}
  if(e.code==='ArrowRight'){e.preventDefault();seek(e.shiftKey?1:beatStep());return}
  const lane={d:0,f:1,j:2,k:3}[k];
  if(lane===undefined)return;
  placeNote(lane);
}

function keydown(e){
  if(document.activeElement&&['SELECT','INPUT'].includes(document.activeElement.tagName))return;
  if(e.code==='Space'&&chart&&!$('#gameScreen').classList.contains('hidden')){e.preventDefault();toggleEditMode();return}
  if(editMode){handleEditKey(e);return}
  if(!running)return;
  const lane={d:0,f:1,j:2,k:3}[e.key.toLowerCase()];if(lane===undefined)return;
  const now=audio.currentTime;
  const c=active.filter(n=>!n.done&&n.lane===lane).map(n=>({n,err:Math.abs(n.time-now)})).sort((a,b)=>a.err-b.err)[0];
  if(!c)return;
  if(c.err<=.05)judge(c.n,'Perfect');else if(c.err<=.10)judge(c.n,'Great');else if(c.err<=.18)judge(c.n,'Good')
}
document.addEventListener('keydown',keydown);function esc(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}init();
