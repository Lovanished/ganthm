const $=s=>document.querySelector(s);const listEl=$('#songList'),playBtn=$('#playSelected'),statusEl=$('#loadStatus');let songs=[],selected=null,chart=null,audio=new Audio();let running=false,startPerf=0,active=[],score=0,combo=0,maxCombo=0,counts={Perfect:0,Great:0,Good:0,Miss:0};const speed=430;
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
};$('#songTitle').textContent=chart.title||s.title||''}
playBtn.onclick=async()=>{try{await loadChart();reset();$('#selectScreen').classList.add('hidden');$('#gameScreen').classList.remove('hidden');try {
  await audio.play();
} catch (err) {
  running = false;
  resultEl.innerHTML = `<div><b>재생 실패</b><br><br>${err.message}<br><br>음원이 브라우저에서 지원되는 형식인지 확인하세요.<br><button onclick="resultEl.classList.add('hidden')">CLOSE</button></div>`;
  resultEl.classList.remove("hidden");
  return;
}
startPerf=performance.now();running=true;requestAnimationFrame(frame)}catch(e){statusEl.textContent='실행 실패: '+e.message;}};
$('#backBtn').onclick=()=>{running=false;audio.pause();audio.currentTime=0;$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden')};
function reset(){score=combo=maxCombo=0;counts={Perfect:0,Great:0,Good:0,Miss:0};$('#result').classList.add('hidden');$('#notes').innerHTML='';active=(chart.notes||[]).map((n,i)=>({...n,i,done:false,el:null}));updateHud();$('#judge').textContent=''}function updateHud(){$('#score').textContent='SCORE '+score;$('#combo').textContent='COMBO '+combo}
function spawn(now){for(const n of active){if(n.el||n.done)continue;if(n.time-now<3){const e=document.createElement('div');e.className='note';e.style.left=(n.lane*25)+'%';$('#notes').appendChild(e);n.el=e}}}
function frame(){if(!running)return;const now=(performance.now()-startPerf)/1000;spawn(now);const h=$('#game').clientHeight,hit=h-88;for(const n of active){if(!n.el||n.done)continue;const d=n.time-now;n.el.style.top=(hit-d*speed-11)+'px';if(d<-.23)judge(n,'Miss')}if(!active.every(n=>n.done))requestAnimationFrame(frame);}
function judge(n,type){if(n.done)return;n.done=true;if(n.el)n.el.remove();counts[type]++;if(type==='Miss')combo=0;else{combo++;maxCombo=Math.max(maxCombo,combo);score+=type==='Perfect'?1000:type==='Great'?700:400}$('#judge').textContent=type;updateHud();if(active.every(x=>x.done))finish()}
function finish(){running=false;$('#result').innerHTML=`<div class="resultBox"><div><b>RESULT</b><br><br>SCORE ${score}<br>MAX COMBO ${maxCombo}<br>Perfect ${counts.Perfect} / Great ${counts.Great} / Good ${counts.Good} / Miss ${counts.Miss}<br><br><button id="closeResult">SONG SELECT</button></div></div>`;$('#result').classList.remove('hidden');$('#closeResult').onclick=()=>{$('#result').classList.add('hidden');$('#gameScreen').classList.add('hidden');$('#selectScreen').classList.remove('hidden')}}
function keydown(e){if(!running)return;const lane={d:0,f:1,j:2,k:3}[e.key.toLowerCase()];if(lane===undefined)return;const now=(performance.now()-startPerf)/1000;const c=active.filter(n=>!n.done&&n.lane===lane).map(n=>({n,err:Math.abs(n.time-now)})).sort((a,b)=>a.err-b.err)[0];if(!c)return;if(c.err<=.05)judge(c.n,'Perfect');else if(c.err<=.10)judge(c.n,'Great');else if(c.err<=.18)judge(c.n,'Good')}
document.addEventListener('keydown',keydown);function esc(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}init();
