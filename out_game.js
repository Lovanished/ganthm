const songSelect=document.querySelector("#songSelect"),startBtn=document.querySelector("#startBtn");
const notesEl=document.querySelector("#notes"),scoreEl=document.querySelector("#score"),comboEl=document.querySelector("#combo"),judgeEl=document.querySelector("#judge"),resultEl=document.querySelector("#result");
let chart=null,audio=new Audio(),startPerf=0,running=false,active=[],score=0,combo=0,counts={Perfect:0,Great:0,Good:0,Miss:0};
const speed=430, hitY=0.0, hitBottom=90;
async function loadSongs(){let r=await fetch("charts/index.json");let a=await r.json();a.forEach((s,i)=>{let o=document.createElement("option");o.value=s.chart;o.textContent=s.title;songSelect.appendChild(o)});}
async function loadChart(){let r=await fetch(songSelect.value);chart=await r.json();audio.src=chart.audio;audio.load();}
function reset(){notesEl.innerHTML="";active=chart.notes.map((n,i)=>({...n,i,done:false,el:null}));score=0;combo=0;counts={Perfect:0,Great:0,Good:0,Miss:0};updateHud();judgeEl.textContent="";resultEl.classList.add("hidden")}
function updateHud(){scoreEl.textContent="SCORE "+score;comboEl.textContent="COMBO "+combo}
function spawn(){for(const n of active){if(n.el||n.done)continue;let t=n.time-(performance.now()-startPerf)/1000;if(t<3){let e=document.createElement("div");e.className="note";e.style.left=(n.lane*25)+"%";e.dataset.i=n.i;notesEl.appendChild(e);n.el=e}}
}
function frame(){if(!running)return;let now=(performance.now()-startPerf)/1000;for(const n of active){if(!n.el||n.done)continue;let d=n.time-now;let y=window.innerHeight;let gameH=document.querySelector("#game").clientHeight;let hit=gameH-hitBottom;let top=hit-(d*speed)-11;n.el.style.top=top+"px";if(d<-.23){judge(n,"Miss",true)}}spawn();requestAnimationFrame(frame)}
function judge(n,type,auto=false){if(n.done)return;n.done=true;if(n.el)n.el.remove();counts[type]++;if(type==="Miss")combo=0;else{combo++;score+=type==="Perfect"?1000:type==="Great"?700:400}judgeEl.textContent=type;updateHud();if(active.every(x=>x.done)){running=false;resultEl.innerHTML=`<div><b>RESULT</b><br><br>SCORE ${score}<br>MAX COMBO ${combo}<br>Perfect ${counts.Perfect} / Great ${counts.Great} / Good ${counts.Good} / Miss ${counts.Miss}<br><br><button onclick="resultEl.classList.add('hidden')">CLOSE</button></div>`;resultEl.classList.remove("hidden")}}
function keydown(e){if(!running)return;const k=e.key.toLowerCase(),lane={d:0,f:1,j:2,k:3}[k];if(lane===undefined)return;let now=(performance.now()-startPerf)/1000;let candidates=active.filter(n=>!n.done&&n.lane===lane).map(n=>({n,e:Math.abs(n.time-now)})).sort((a,b)=>a.e-b.e);if(!candidates.length)return;let x=candidates[0];if(x.e<=.05)judge(x.n,"Perfect");else if(x.e<=.10)judge(x.n,"Great");else if(x.e<=.18)judge(x.n,"Good")}
document.addEventListener("keydown",keydown);
startBtn.onclick=async()=>{if(!chart)await loadChart();reset();await audio.play();startPerf=performance.now();running=true;requestAnimationFrame(frame)};
songSelect.onchange=loadChart;loadSongs().then(loadChart);
