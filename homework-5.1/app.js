const els = {
  input: document.getElementById("dataInput"),
  reset: document.getElementById("resetBtn"),
  next: document.getElementById("nextBtn"),
  runAll: document.getElementById("runAllBtn"),
  badge: document.getElementById("streamBadge"),
  n: document.getElementById("nValue"),
  x: document.getElementById("xValue"),
  mean: document.getElementById("meanValue"),
  m2: document.getElementById("m2Value"),
  delta: document.getElementById("deltaValue"),
  meanUpdate: document.getElementById("meanUpdateValue"),
  m2Increment: document.getElementById("m2IncrementValue"),
  insight: document.getElementById("streamInsight"),
  svg: document.getElementById("numberLine"),
  directMean: document.getElementById("directMean"),
  welfordMean: document.getElementById("welfordMean"),
  meanDiff: document.getElementById("meanDiff"),
  directPopVar: document.getElementById("directPopVar"),
  welfordPopVar: document.getElementById("welfordPopVar"),
  popVarDiff: document.getElementById("popVarDiff"),
  directSampleVar: document.getElementById("directSampleVar"),
  welfordSampleVar: document.getElementById("welfordSampleVar"),
  sampleVarDiff: document.getElementById("sampleVarDiff"),
  verificationInsight: document.getElementById("verificationInsight")
};

function fmt(x, digits = 4) {
  if (!Number.isFinite(x)) return "–";
  return Number((Math.abs(x) < 1e-12 ? 0 : x).toFixed(digits)).toString();
}

function svgEl(name, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  return e;
}

/* ---------- Experiment 1: running mean ---------- */
const meanData = [12, 7, 15, 9, 18, 11, 6, 14, 10, 17, 8, 13];
let meanIndex = 0;
let meanRunning = 0;
let meanHistory = [];

const meanEls = {
  next: document.getElementById("meanNextBtn"),
  run: document.getElementById("meanRunBtn"),
  reset: document.getElementById("meanResetBtn"),
  seen: document.getElementById("meanSeen"),
  old: document.getElementById("meanOld"),
  incoming: document.getElementById("meanIncoming"),
  updated: document.getElementById("meanNew"),
  text: document.getElementById("meanExperimentText"),
  svg: document.getElementById("meanExperimentLine")
};

function drawMeanChart() {
  const svg = meanEls.svg;
  svg.innerHTML = "";
  const W=920,H=330,L=65,R=25,T=25,B=55;
  const plotW=W-L-R, plotH=H-T-B;
  const yMin=4,yMax=20;
  const xMap=i => L + (i/(meanData.length-1))*plotW;
  const yMap=v => T + (yMax-v)/(yMax-yMin)*plotH;

  svg.appendChild(svgEl("line",{x1:L,y1:H-B,x2:W-R,y2:H-B,stroke:"#94a3b8","stroke-width":"1.5"}));
  svg.appendChild(svgEl("line",{x1:L,y1:T,x2:L,y2:H-B,stroke:"#94a3b8","stroke-width":"1.5"}));

  for(let v=4;v<=20;v+=4){
    const y=yMap(v);
    svg.appendChild(svgEl("line",{x1:L,y1:y,x2:W-R,y2:y,stroke:"#e5e7eb","stroke-width":"1"}));
    const t=svgEl("text",{x:L-10,y:y+4,"text-anchor":"end",fill:"#64748b","font-size":"12"});t.textContent=v;svg.appendChild(t);
  }
  for(let i=0;i<meanData.length;i++){
    const x=xMap(i);
    const t=svgEl("text",{x,y:H-B+22,"text-anchor":"middle",fill:"#64748b","font-size":"11"});t.textContent=i+1;svg.appendChild(t);
  }

  const xTitle=svgEl("text",{x:L+plotW/2,y:H-10,"text-anchor":"middle",fill:"#334155","font-size":"12","font-weight":"700"});
  xTitle.textContent="Observation order";svg.appendChild(xTitle);
  const yTitle=svgEl("text",{x:16,y:T+plotH/2,transform:`rotate(-90 16 ${T+plotH/2})`,"text-anchor":"middle",fill:"#334155","font-size":"12","font-weight":"700"});
  yTitle.textContent="Value";svg.appendChild(yTitle);

  if(meanHistory.length){
    let obsPath="";
    meanHistory.forEach((row,i)=>{
      const x=xMap(i), y=yMap(row.x);
      obsPath += (i?" L ":"M ")+x+" "+y;
    });
    svg.appendChild(svgEl("path",{d:obsPath,fill:"none",stroke:"#94a3b8","stroke-width":"2"}));

    let meanPath="";
    meanHistory.forEach((row,i)=>{
      const x=xMap(i), y=yMap(row.mean);
      meanPath += (i?" L ":"M ")+x+" "+y;
    });
    svg.appendChild(svgEl("path",{d:meanPath,fill:"none",stroke:"#16a34a","stroke-width":"3"}));

    meanHistory.forEach((row,i)=>{
      svg.appendChild(svgEl("circle",{cx:xMap(i),cy:yMap(row.x),r:"6",fill:"#2563eb"}));
      svg.appendChild(svgEl("circle",{cx:xMap(i),cy:yMap(row.mean),r:"4",fill:"#16a34a"}));
    });

    const leg1=svgEl("text",{x:W-210,y:20,fill:"#2563eb","font-size":"12","font-weight":"700"});leg1.textContent="● observation";svg.appendChild(leg1);
    const leg2=svgEl("text",{x:W-105,y:20,fill:"#15803d","font-size":"12","font-weight":"700"});leg2.textContent="● running mean";svg.appendChild(leg2);
  }
}

function meanNext() {
  if(meanIndex>=meanData.length){
    meanEls.text.innerHTML="<strong>Complete.</strong> Notice how the running mean becomes progressively more stable.";
    return false;
  }
  const x=meanData[meanIndex];
  const old = meanIndex===0 ? null : meanRunning;
  meanIndex++;
  const delta=x-meanRunning;
  meanRunning += delta/meanIndex;
  meanHistory.push({x,mean:meanRunning});

  meanEls.seen.textContent=`${meanIndex} / ${meanData.length}`;
  meanEls.old.textContent=old===null?"–":fmt(old);
  meanEls.incoming.textContent=fmt(x);
  meanEls.updated.textContent=fmt(meanRunning);

  if(old===null){
    meanEls.text.innerHTML=`The first observation is ${x}, so the first mean is also ${x}.`;
  } else {
    const rel=x>old?"above":"below";
    const dir=x>old?"upward":"downward";
    meanEls.text.innerHTML=`Observation ${meanIndex} is ${x}, which is ${rel} the old mean ${fmt(old)}. It pulls the mean ${dir}, producing a new mean of ${fmt(meanRunning)}.`;
  }
  drawMeanChart();
  return true;
}
function meanRun(){ while(meanNext()){} }
function meanReset(){
  meanIndex=0;meanRunning=0;meanHistory=[];
  meanEls.seen.textContent=`0 / ${meanData.length}`;
  meanEls.old.textContent="–";meanEls.incoming.textContent="–";meanEls.updated.textContent="–";
  meanEls.text.innerHTML='Press <strong>Next observation</strong>. The first point creates the first mean; after that, watch how every incoming value moves the running mean.';
  drawMeanChart();
}
meanEls.next.addEventListener("click",meanNext);
meanEls.run.addEventListener("click",meanRun);
meanEls.reset.addEventListener("click",meanReset);

/* ---------- Experiment 2: variance ---------- */
const varianceSets = {
  tight: [9,11,10,12,8,10,11,9,12,10,8,11],
  wide: [2,17,6,15,4,18,9,13,1,19,7,14],
  mixed: [7,13,9,12,5,16,10,8,14,6,11,15]
};
const varEls = {
  dataset:document.getElementById("varDataset"),
  mean:document.getElementById("varMean"),
  ss:document.getElementById("varSS"),
  value:document.getElementById("varValue"),
  list:document.getElementById("varianceObservationList"),
  insight:document.getElementById("varianceInsight"),
  svg:document.getElementById("varianceAxisChart")
};

function drawVarianceChart(values, mean) {
  const svg=varEls.svg;svg.innerHTML="";
  const W=920,H=330,L=65,R=25,T=25,B=55;
  const plotW=W-L-R,plotH=H-T-B;
  const minV=Math.min(...values,mean), maxV=Math.max(...values,mean);
  const pad=Math.max((maxV-minV)*.15,1.5);
  const yMin=minV-pad,yMax=maxV+pad;
  const xMap=i=>L+(i/(values.length-1))*plotW;
  const yMap=v=>T+(yMax-v)/(yMax-yMin)*plotH;

  svg.appendChild(svgEl("line",{x1:L,y1:H-B,x2:W-R,y2:H-B,stroke:"#94a3b8","stroke-width":"1.5"}));
  svg.appendChild(svgEl("line",{x1:L,y1:T,x2:L,y2:H-B,stroke:"#94a3b8","stroke-width":"1.5"}));

  for(let k=0;k<=4;k++){
    const v=yMin+(k/4)*(yMax-yMin), y=yMap(v);
    svg.appendChild(svgEl("line",{x1:L,y1:y,x2:W-R,y2:y,stroke:"#e5e7eb","stroke-width":"1"}));
    const t=svgEl("text",{x:L-10,y:y+4,"text-anchor":"end",fill:"#64748b","font-size":"12"});t.textContent=fmt(v,1);svg.appendChild(t);
  }

  const meanY=yMap(mean);
  svg.appendChild(svgEl("line",{x1:L,y1:meanY,x2:W-R,y2:meanY,stroke:"#16a34a","stroke-width":"3","stroke-dasharray":"7 5"}));
  const mt=svgEl("text",{x:W-R-4,y:meanY-8,"text-anchor":"end",fill:"#15803d","font-size":"12","font-weight":"700"});mt.textContent=`mean = ${fmt(mean)}`;svg.appendChild(mt);

  values.forEach((v,i)=>{
    const x=xMap(i), y=yMap(v);
    svg.appendChild(svgEl("line",{x1:x,y1:meanY,x2:x,y2:y,stroke:"#cbd5e1","stroke-width":"2"}));
    svg.appendChild(svgEl("circle",{cx:x,cy:y,r:"6",fill:"#2563eb"}));
    const xt=svgEl("text",{x,y:H-B+22,"text-anchor":"middle",fill:"#64748b","font-size":"11"});xt.textContent=i+1;svg.appendChild(xt);
  });

  const xTitle=svgEl("text",{x:L+plotW/2,y:H-10,"text-anchor":"middle",fill:"#334155","font-size":"12","font-weight":"700"});xTitle.textContent="Observation order";svg.appendChild(xTitle);
  const yTitle=svgEl("text",{x:16,y:T+plotH/2,transform:`rotate(-90 16 ${T+plotH/2})`,"text-anchor":"middle",fill:"#334155","font-size":"12","font-weight":"700"});yTitle.textContent="Value";svg.appendChild(yTitle);
}

function renderVariance(values, message){
  const m=values.reduce((a,b)=>a+b,0)/values.length;
  const rows=values.map(x=>({x,d:x-m,sq:(x-m)**2}));
  const ss=rows.reduce((a,r)=>a+r.sq,0);
  const variance=ss/values.length;
  varEls.dataset.textContent=values.join(", ");
  varEls.mean.textContent=fmt(m);
  varEls.ss.textContent=fmt(ss);
  varEls.value.textContent=fmt(variance);
  varEls.list.innerHTML="";
  rows.slice(0,6).forEach((r,i)=>{
    const div=document.createElement("div");
    div.className="variance-observation";
    const sign=r.d>0?"+":"";
    div.innerHTML=`<span>Observation ${i+1}: <strong>${fmt(r.x)}</strong></span><span>Deviation: <strong>${sign}${fmt(r.d)}</strong></span><span>Squared: <strong>${fmt(r.sq)}</strong></span>`;
    varEls.list.appendChild(div);
  });
  const note=document.createElement("div");
  note.className="variance-observation";
  note.innerHTML=`<span><strong>Showing first 6 deviations</strong></span><span>All ${values.length} values are used</span><span>Variance = ${fmt(variance)}</span>`;
  varEls.list.appendChild(note);
  varEls.insight.innerHTML=message;
  drawVarianceChart(values,m);
}
document.getElementById("varianceTight").addEventListener("click",()=>renderVariance(varianceSets.tight,"The points stay close to the mean line. Their vertical distances are small, so the variance is small."));
document.getElementById("varianceWide").addEventListener("click",()=>renderVariance(varianceSets.wide,"The mean is still near the center, but many points are far above or below it. The squared deviations become large, so variance increases sharply."));
document.getElementById("varianceMixed").addEventListener("click",()=>renderVariance(varianceSets.mixed,"This dataset has an intermediate spread. Compare the vertical distances to the mean with the compact and dispersed cases."));

/* ---------- Full Welford experiment ---------- */
let data=[], index=0, n=0, mean=0, M2=0, processed=[];
let lastOldMean=null,lastNewMean=null;
function parseData(){return els.input.value.split(",").map(v=>Number(v.trim())).filter(Number.isFinite);}
function directStats(values){
  if(!values.length)return{mean:NaN,popVar:NaN,sampleVar:NaN};
  const m=values.reduce((a,b)=>a+b,0)/values.length;
  const ss=values.reduce((s,x)=>s+(x-m)**2,0);
  return{mean:m,popVar:ss/values.length,sampleVar:values.length>1?ss/(values.length-1):NaN};
}
function resetState(){
  data=parseData();index=0;n=0;mean=0;M2=0;processed=[];lastOldMean=null;lastNewMean=null;
  els.n.textContent="0";els.x.textContent="–";els.mean.textContent="0";els.m2.textContent="0";
  els.delta.textContent="–";els.meanUpdate.textContent="–";els.m2Increment.textContent="–";
  els.badge.textContent=data.length?"Ready":"No valid data";
  els.insight.innerHTML=data.length?'Press <strong>Next observation</strong> to process the first value.':"Enter comma-separated numeric values.";
  updateVerification();drawNumberLine();
}
function processNext(){
  if(index>=data.length){els.badge.textContent="Complete";els.insight.innerHTML="<strong>Stream complete.</strong>";return false;}
  const x=data[index],oldMean=mean;n++;
  const delta=x-mean;mean+=delta/n;const inc=delta*(x-mean);M2+=inc;
  processed.push(x);index++;lastOldMean=oldMean;lastNewMean=mean;
  els.n.textContent=n;els.x.textContent=fmt(x);els.mean.textContent=fmt(mean);els.m2.textContent=fmt(M2);
  els.delta.textContent=`${fmt(x)} − ${fmt(oldMean)} = ${fmt(delta)}`;
  els.meanUpdate.textContent=`${fmt(oldMean)} + ${fmt(delta)}/${n} = ${fmt(mean)}`;
  els.m2Increment.textContent=`${fmt(delta)} × (${fmt(x)} − ${fmt(mean)}) = ${fmt(inc)}`;
  els.badge.textContent=index<data.length?`Processed ${index}/${data.length}`:"Complete";
  els.insight.innerHTML=`<strong>Observation ${n}:</strong> x = ${fmt(x)}. Mean ${fmt(oldMean)} → ${fmt(mean)}; M₂ increases by ${fmt(inc)}.`;
  updateVerification();drawNumberLine();return true;
}
function runAll(){while(processNext()){}}
function updateVerification(){
  const d=directStats(processed),wp=n?M2/n:NaN,ws=n>1?M2/(n-1):NaN;
  els.directMean.textContent=fmt(d.mean,8);els.welfordMean.textContent=fmt(n?mean:NaN,8);els.meanDiff.textContent=fmt(n?Math.abs(d.mean-mean):NaN,12);
  els.directPopVar.textContent=fmt(d.popVar,8);els.welfordPopVar.textContent=fmt(wp,8);els.popVarDiff.textContent=fmt(n?Math.abs(d.popVar-wp):NaN,12);
  els.directSampleVar.textContent=fmt(d.sampleVar,8);els.welfordSampleVar.textContent=fmt(ws,8);els.sampleVarDiff.textContent=fmt(n>1?Math.abs(d.sampleVar-ws):NaN,12);
  if(!n)els.verificationInsight.textContent="Process the stream to compare the two methods.";
  else if(n===1)els.verificationInsight.textContent="Sample variance needs at least two observations.";
  else els.verificationInsight.textContent="The direct computation and Welford agree up to floating-point rounding.";
}
function drawNumberLine(){
  const svg=els.svg;svg.innerHTML="";
  const vals=data.length?[...data]:[0,1];if(lastOldMean!==null)vals.push(lastOldMean);if(lastNewMean!==null)vals.push(lastNewMean);
  let min=Math.min(...vals),max=Math.max(...vals);if(min===max){min-=1;max+=1}const pad=Math.max((max-min)*.12,1);min-=pad;max+=pad;
  const left=70,right=830,y=88,mapX=v=>left+((v-min)/(max-min))*(right-left);
  svg.appendChild(svgEl("line",{x1:left,y1:y,x2:right,y2:y,stroke:"#94a3b8","stroke-width":"2"}));
  for(let i=0;i<=7;i++){const v=min+(i/7)*(max-min),x=mapX(v);svg.appendChild(svgEl("line",{x1:x,y1:y-6,x2:x,y2:y+6,stroke:"#cbd5e1"}));const t=svgEl("text",{x,y:y+26,"text-anchor":"middle",fill:"#64748b","font-size":"12"});t.textContent=fmt(v,1);svg.appendChild(t);}
  processed.forEach((v,i)=>svg.appendChild(svgEl("circle",{cx:mapX(v),cy:y,r:i===processed.length-1?7:5,fill:i===processed.length-1?"#2563eb":"#94a3b8"})));
  if(lastOldMean!==null){const x=mapX(lastOldMean);svg.appendChild(svgEl("line",{x1:x,y1:28,x2:x,y2:y-12,stroke:"#f59e0b","stroke-width":"3","stroke-dasharray":"5 4"}));}
  if(lastNewMean!==null){const x=mapX(lastNewMean);svg.appendChild(svgEl("line",{x1:x,y1:38,x2:x,y2:y-12,stroke:"#16a34a","stroke-width":"3"}));}
}

meanReset();
renderVariance(varianceSets.tight,"The points stay close to the mean line. Their vertical distances are small, so the variance is small.");
els.reset.addEventListener("click",resetState);
els.next.addEventListener("click",processNext);
els.runAll.addEventListener("click",runAll);
els.input.addEventListener("change",resetState);
resetState();
