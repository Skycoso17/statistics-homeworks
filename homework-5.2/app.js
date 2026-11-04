const MU=6,SIGMA2=2.4;const $=id=>document.getElementById(id);const fmt=(x,d=4)=>Number.isFinite(x)?Number(x.toFixed(d)).toString():"–";
function binomial10p06(){let s=0;for(let i=0;i<10;i++)if(Math.random()<.6)s++;return s}
function welfordSample(n){let mean=0,M2=0;const values=[];for(let k=1;k<=n;k++){const x=binomial10p06();values.push(x);const delta=x-mean;mean+=delta/k;M2+=delta*(x-mean)}return{mean,variance:n>1?M2/(n-1):NaN,values}}
function avg(a){return a.reduce((x,y)=>x+y,0)/a.length}function varPop(a){const m=avg(a);return a.reduce((s,x)=>s+(x-m)**2,0)/a.length}function sd(a){return Math.sqrt(varPop(a))}
let charts={};function destroy(name){if(charts[name])charts[name].destroy()}
function hist(values,bins,min,max){const w=(max-min)/bins,counts=Array(bins).fill(0);for(const x of values){let i=Math.floor((x-min)/w);if(i<0)i=0;if(i>=bins)i=bins-1;counts[i]++}return{labels:counts.map((_,i)=>fmt(min+(i+.5)*w,2)),counts}}
(function(){const p=[];function C(n,k){let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}for(let k=0;k<=10;k++)p.push(C(10,k)*.6**k*.4**(10-k));charts.population=new Chart($("populationChart"),{type:"bar",data:{labels:[0,1,2,3,4,5,6,7,8,9,10],datasets:[{label:"Probability",data:p}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:"Penetration score"}},y:{title:{display:true,text:"Probability"},beginAtZero:true}}}})})();
let oneScores=[],oneIndex=0,oneMean=0,oneM2=0,oneRows=[];
function drawOne(){destroy("single");charts.single=new Chart($("singleHackerChart"),{type:"line",data:{labels:oneRows.map((_,i)=>i+1),datasets:[{label:"Score",data:oneRows.map(r=>r.x),tension:.15,pointRadius:4},{label:"Running mean",data:oneRows.map(r=>r.mean),tension:.15,pointRadius:2},{label:"Theoretical μ = 6",data:oneRows.map(()=>MU),borderDash:[7,5],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:"System attempted"}},y:{title:{display:true,text:"Score / running mean"},min:0,max:10}}}})}
function newOne(){oneScores=Array.from({length:30},binomial10p06);oneIndex=0;oneMean=0;oneM2=0;oneRows=[];$("oneK").textContent="0 / 30";$("oneX").textContent="–";$("oneMean").textContent="–";$("oneVar").textContent="–";$("oneInsight").textContent="A new hacker is ready. Process the first score.";const tb=$("trajectoryBody");if(tb)tb.innerHTML="";drawOne()}
function oneNext(){
  if(oneIndex>=oneScores.length){
    $("oneInsight").textContent="Trajectory complete. Compare the final estimates with μ = 6 and σ² = 2.4.";
    return false
  }
  const x=oneScores[oneIndex],k=oneIndex+1;
  const oldMean=oneMean;
  const delta=x-oneMean;
  oneMean+=delta/k;
  oneM2+=delta*(x-oneMean);
  oneIndex++;
  const v=k>1?oneM2/(k-1):NaN;
  oneRows.push({x,mean:oneMean,variance:v});
  $("oneK").textContent=`${k} / 30`;
  $("oneX").textContent=x;
  $("oneMean").textContent=fmt(oneMean);
  $("oneVar").textContent=fmt(v);
  $("oneInsight").innerHTML=`Score ${k}: <strong>${x}</strong>. The old mean was <strong>${fmt(oldMean)}</strong>, so δ = <strong>${fmt(delta)}</strong>. The updated mean becomes <strong>${fmt(oneMean)}</strong>${k>1?` and the current sample variance is <strong>${fmt(v)}</strong>`:"."}`;
  const tb=$("trajectoryBody");
  if(tb){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${k}</td><td>${x}</td><td>${fmt(delta)}</td><td>${fmt(oneMean)}</td><td>${fmt(v)}</td>`;
    tb.appendChild(tr);
  }
  drawOne();
  return true
}
$("oneNext").addEventListener("click",oneNext);$("oneRun").addEventListener("click",()=>{while(oneNext()){} });$("oneReset").addEventListener("click",newOne);
let currentMeans=[],currentVars=[],currentN=50,currentM=1000;
function simulate(n,m){const means=[],vars=[];for(let j=0;j<m;j++){const r=welfordSample(n);means.push(r.mean);vars.push(r.variance)}return{means,vars}}
function drawSampling(){const theoreticalSd=Math.sqrt(SIGMA2/currentN);let minM=Math.min(...currentMeans),maxM=Math.max(...currentMeans);if(minM===maxM){minM-=.1;maxM+=.1}const h1=hist(currentMeans,26,minM-.001,maxM+.001);destroy("means");charts.means=new Chart($("meansChart"),{type:"bar",data:{labels:h1.labels,datasets:[{label:"Hackers",data:h1.counts}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:"Sample mean"}},y:{title:{display:true,text:"Number of hackers"},beginAtZero:true}}}});$("meansInsight").innerHTML=`Empirical SD of sample means: <strong>${fmt(sd(currentMeans))}</strong>. Theory predicts √(σ²/n) = <strong>${fmt(theoreticalSd)}</strong>.`;const maxV=Math.max(...currentVars);const h2=hist(currentVars,26,0,maxV+.001);destroy("vars");charts.vars=new Chart($("variancesChart"),{type:"bar",data:{labels:h2.labels,datasets:[{label:"Hackers",data:h2.counts}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:"Sample variance"}},y:{title:{display:true,text:"Number of hackers"},beginAtZero:true}}}});$("varsInsight").innerHTML=`The sample variances are centered near <strong>2.4</strong>. Their empirical SD is <strong>${fmt(sd(currentVars))}</strong>.`}
function updateAnalysis(am,av){$("analysisBody").innerHTML=`<tr><td>Average sample mean</td><td>μ = 6</td><td>${fmt(am)}</td><td>The estimator is centered on μ.</td></tr><tr><td>Average sample variance</td><td>σ² = 2.4</td><td>${fmt(av)}</td><td>Using n−1 makes s² unbiased.</td></tr><tr><td>SD of sampling means</td><td>√(2.4/${currentN}) = ${fmt(Math.sqrt(SIGMA2/currentN))}</td><td>${fmt(sd(currentMeans))}</td><td>The variability of x̄ decreases like 1/√n.</td></tr>`;$("finalAnalysis").innerHTML=`For n = <strong>${currentN}</strong>, the simulation shows correct centering and sampling variability: estimates fluctuate, but their distributions remain anchored to the population parameters.`}
function runMain(){currentN=+$("systems").value;currentM=+$("hackers").value;const r=simulate(currentN,currentM);currentMeans=r.means;currentVars=r.vars;const am=avg(currentMeans),av=avg(currentVars);$("avgMeans").textContent=fmt(am);$("meanError").textContent=fmt(am-MU);$("avgVars").textContent=fmt(av);$("varError").textContent=fmt(av-SIGMA2);$("mainInsight").innerHTML=`Across <strong>${currentM}</strong> hackers, average sample mean = <strong>${fmt(am)}</strong>; average sample variance = <strong>${fmt(av)}</strong>. Small differences from theory are expected because the simulation is random.`;drawSampling();updateAnalysis(am,av)}
$("systems").addEventListener("input",e=>$("systemsValue").textContent=e.target.value);$("hackers").addEventListener("input",e=>$("hackersValue").textContent=e.target.value);$("runExperiment").addEventListener("click",runMain);$("newSample").addEventListener("click",runMain);
function runComparison(){const m=+$("comparisonM").value,ns=[5,10,30,100,300],rows=ns.map(n=>{const r=simulate(n,m);return{n,meanOfVars:avg(r.vars),sdMeans:sd(r.means),sdVars:sd(r.vars),theorySdMean:Math.sqrt(SIGMA2/n)}});destroy("nmeans");charts.nmeans=new Chart($("nEffectMeansChart"),{type:"line",data:{labels:ns,datasets:[{label:"Empirical SD of sample means",data:rows.map(r=>r.sdMeans),tension:.2},{label:"Theoretical √(σ²/n)",data:rows.map(r=>r.theorySdMean),borderDash:[7,5],tension:.2}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:"n = systems per hacker"}},y:{title:{display:true,text:"SD of sample means"},beginAtZero:true}}}});$("nMeanInsight").innerHTML="The curves nearly overlap: increasing n sharply reduces the spread of sample means, exactly as Var(x̄)=σ²/n predicts.";destroy("nvars");charts.nvars=new Chart($("nEffectVarsChart"),{type:"line",data:{labels:ns,datasets:[{label:"Empirical SD of sample variances",data:rows.map(r=>r.sdVars),tension:.2},{label:"Average sample variance",data:rows.map(r=>r.meanOfVars),tension:.2},{label:"Theoretical σ² = 2.4",data:rows.map(()=>SIGMA2),borderDash:[7,5],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:"n = systems per hacker"}},y:{title:{display:true,text:"Variance-estimator behavior"},beginAtZero:true}}}});$("nVarInsight").innerHTML="The average sample variance stays near 2.4 for every n, while the spread of the variance estimator decreases. Larger samples make s² more stable."}
$("runComparison").addEventListener("click",runComparison);
newOne();runMain();runComparison();
