const state = { model: 'bernoulli', charts: {} };

const $ = id => document.getElementById(id);
const range = n => Array.from({length:n}, (_,i) => i + 1);

function randBernoulli(p){ return Math.random() < p ? 1 : 0; }
function randRademacher(){ return Math.random() < 0.5 ? -1 : 1; }
function mean(a){ return a.reduce((s,x)=>s+x,0)/a.length; }
function variance(a){ const mu=mean(a); return a.reduce((s,x)=>s+(x-mu)**2,0)/a.length; }
function cumulative(a){ let s=0; return a.map(x => (s += x)); }

function sampleTrajectory(model,n,p){
  const out = new Array(n);
  for(let i=0;i<n;i++) out[i] = model === 'bernoulli' ? randBernoulli(p) : randRademacher();
  return out;
}

function simulate(model,n,m,p){
  const totals = new Array(m);
  for(let j=0;j<m;j++){
    let s=0;
    for(let i=0;i<n;i++) s += model === 'bernoulli' ? randBernoulli(p) : randRademacher();
    totals[j]=s;
  }
  return {
    totals,
    averages: totals.map(x=>x/n),
    normalized: totals.map(x=>x/Math.sqrt(n))
  };
}

function destroy(name){ if(state.charts[name]) state.charts[name].destroy(); }

function chartDefaults(){
  return {
    responsive:true,
    maintainAspectRatio:false,
    animation:false,
    plugins:{ legend:{ labels:{ color:'#475569' } } },
    scales:{
      x:{ ticks:{color:'#64748b', maxTicksLimit:10}, grid:{color:'rgba(15,23,42,.08)'} },
      y:{ ticks:{color:'#64748b'}, grid:{color:'rgba(15,23,42,.08)'} }
    }
  };
}

function lineColor(i){
  const palette=['#2563eb','#16a34a','#db2777','#d97706','#7c3aed','#0891b2','#ea580c','#dc2626'];
  return palette[i % palette.length];
}

function histogram(values,bins=28){
  const lo=Math.min(...values), hi=Math.max(...values);
  if(lo===hi) return {labels:[lo.toFixed(3)],counts:[values.length],centers:[lo],width:1};
  const width=(hi-lo)/bins, counts=Array(bins).fill(0), centers=[];
  for(let i=0;i<bins;i++) centers.push(lo+(i+.5)*width);
  values.forEach(v=>{ let k=Math.floor((v-lo)/width); if(k===bins) k=bins-1; counts[k]++; });
  return {labels:centers.map(x=>x.toFixed(3)),counts,centers,width};
}

function drawTrajectories(model,n,p){
  destroy('trajectory');
  const datasets=[];
  for(let i=0;i<7;i++){
    const path=cumulative(sampleTrajectory(model,n,p));
    datasets.push({label:`Attacker ${i+1}`,data:path,borderColor:lineColor(i),borderWidth:1.6,pointRadius:0,tension:.08});
  }
  state.charts.trajectory = new Chart($('trajectoryChart'), {type:'line',data:{labels:range(n),datasets},options:chartDefaults()});
}

function drawAverage(model,n,p){
  destroy('average');
  const datasets=[];
  for(let i=0;i<7;i++){
    const path=cumulative(sampleTrajectory(model,n,p));
    datasets.push({label:`Attacker ${i+1}`,data:path.map((x,k)=>x/(k+1)),borderColor:lineColor(i),borderWidth:1.35,pointRadius:0,tension:.08});
  }
  const target = model === 'bernoulli' ? p : 0;
  datasets.push({label:`Expected value = ${target.toFixed(2)}`,data:Array(n).fill(target),borderColor:'#111827',borderDash:[7,6],borderWidth:2,pointRadius:0});
  state.charts.average = new Chart($('averageChart'), {type:'line',data:{labels:range(n),datasets},options:chartDefaults()});
}

function drawHistogramChart(name, canvasId, values, label, color='rgba(37,99,235,.55)'){
  destroy(name);
  const h=histogram(values,26);
  state.charts[name] = new Chart($(canvasId), {
    type:'bar',
    data:{labels:h.labels,datasets:[{label,data:h.counts,backgroundColor:color,borderColor:'#2563eb',borderWidth:1}]},
    options:{...chartDefaults(), plugins:{legend:{display:false}}}
  });
}

function drawDistributions(sim){
  drawHistogramChart('total','totalChart',sim.totals,'Total score');
  drawHistogramChart('avgDist','averageDistributionChart',sim.averages,'Average score','rgba(22,163,74,.45)');
  drawHistogramChart('normDist','normalizedDistributionChart',sim.normalized,'Normalized score','rgba(219,39,119,.42)');
}

function drawVariance(model,p){
  destroy('variance');
  const ns=[10,20,50,100,200,500,1000];
  const vt=[], va=[], vn=[];
  ns.forEach(n=>{
    const sim=simulate(model,n,1800,p);
    vt.push(variance(sim.totals));
    va.push(variance(sim.averages));
    vn.push(variance(sim.normalized));
  });
  const opts=chartDefaults();
  opts.scales.y.type='logarithmic';
  state.charts.variance = new Chart($('varianceChart'), {
    type:'line',
    data:{labels:ns,datasets:[
      {label:'Var(Sₙ)',data:vt,borderColor:'#2563eb',backgroundColor:'#2563eb',pointRadius:4},
      {label:'Var(Sₙ/n)',data:va,borderColor:'#16a34a',backgroundColor:'#16a34a',pointRadius:4},
      {label:'Var(Sₙ/√n)',data:vn,borderColor:'#db2777',backgroundColor:'#db2777',pointRadius:4}
    ]}, options:opts
  });
}

function normalPdf(x){ return Math.exp(-.5*x*x)/Math.sqrt(2*Math.PI); }

function drawCLT(n){
  destroy('clt');
  const sim=simulate('rademacher',n,14000,.5);
  const h=histogram(sim.normalized,34);
  const density=h.counts.map(c=>c/(sim.normalized.length*h.width));
  const theoretical=h.centers.map(normalPdf);
  state.charts.clt = new Chart($('cltChart'), {
    data:{labels:h.labels,datasets:[
      {type:'bar',label:'Empirical density',data:density,backgroundColor:'rgba(37,99,235,.48)',borderColor:'#2563eb',borderWidth:1},
      {type:'line',label:'N(0,1)',data:theoretical,borderColor:'#16a34a',borderWidth:3,pointRadius:0,tension:.22}
    ]}, options:chartDefaults()
  });
  $('cltInsight').innerHTML = n <= 20
    ? `For <span class="math">n=${n}</span> the normalized score is still clearly discrete: only a limited set of values is possible. The normal curve already gives the general central shape, but the approximation is still rough.`
    : n < 200
      ? `For <span class="math">n=${n}</span> the histogram has many more possible values and begins to resemble the bell curve. We are seeing the transition predicted by the Central Limit Theorem.`
      : `For <span class="math">n=${n}</span> the empirical density follows the standard normal curve closely. This is the expected large-n behavior of <span class="math">Sₙ/√n</span> in the Rademacher model.`;
}

function drawMEffect(model,n,p){
  destroy('mEffect');
  const ms=[20,50,100,200,500,1000,2000,5000];
  const estimates=[];
  ms.forEach(m=>{
    const sim=simulate(model,n,m,p);
    estimates.push(mean(sim.averages));
  });
  const target=model==='bernoulli'?p:0;
  state.charts.mEffect = new Chart($('mEffectChart'), {
    type:'line',
    data:{labels:ms,datasets:[
      {label:'Empirical mean of Sₙ/n',data:estimates,borderColor:'#2563eb',backgroundColor:'#2563eb',pointRadius:4},
      {label:'Theoretical E[X]',data:Array(ms.length).fill(target),borderColor:'#16a34a',borderDash:[7,6],borderWidth:2,pointRadius:0}
    ]}, options:chartDefaults()
  });
  $('mInsight').innerHTML = `The horizontal reference is the theoretical value <span class="math">E[X]=${target.toFixed(2)}</span>. With very small <span class="math">m</span>, the empirical estimate can visibly miss the target. As more independent attackers are included, the estimate is usually more stable. This is a sampling-accuracy effect: <span class="math">m</span> does not change the law of one trajectory.`;
}

function updateStats(sim){
  $('meanTotal').textContent=mean(sim.totals).toFixed(3);
  $('varianceTotal').textContent=variance(sim.totals).toFixed(3);
  $('meanAverage').textContent=mean(sim.averages).toFixed(4);
  $('varianceAverage').textContent=variance(sim.averages).toFixed(6);
  $('varianceNormalized').textContent=variance(sim.normalized).toFixed(4);
}

function theoretical(model,n,p){
  const mu=model==='bernoulli'?p:0;
  const sigma2=model==='bernoulli'?p*(1-p):1;
  return {
    mu, sigma2,
    meanTotal:n*mu,
    varTotal:n*sigma2,
    meanAverage:mu,
    varAverage:sigma2/n,
    meanNormalized:Math.sqrt(n)*mu,
    varNormalized:sigma2
  };
}

function updateAnalysisTable(model,n,p,sim){
  const t=theoretical(model,n,p);
  const rows=[
    ['E[Sₙ]', t.meanTotal.toFixed(4), mean(sim.totals).toFixed(4), 'Expected total score after n independent increments.'],
    ['Var(Sₙ)', t.varTotal.toFixed(4), variance(sim.totals).toFixed(4), 'Absolute spread grows proportionally to n.'],
    ['E[Sₙ/n]', t.meanAverage.toFixed(4), mean(sim.averages).toFixed(4), 'Target of the Law of Large Numbers.'],
    ['Var(Sₙ/n)', t.varAverage.toFixed(6), variance(sim.averages).toFixed(6), 'Shrinks like 1/n, explaining concentration of the average.'],
    ['Var(Sₙ/√n)', t.varNormalized.toFixed(4), variance(sim.normalized).toFixed(4), 'Remains independent of n under square-root scaling.']
  ];
  $('analysisTableBody').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');

  const avgError=Math.abs(mean(sim.averages)-t.meanAverage);
  $('finalAnalysis').innerHTML=`In this run the empirical average differs from its theoretical target by about <span class="math">${avgError.toFixed(4)}</span>. That difference is itself a consequence of randomness: with a finite sample we should not expect an exact match. The useful point is that the simulation lets us compare theory with observed data and see that, as n and m become sufficiently large, the empirical behavior follows the theoretical predictions for mean, variance, LLN and CLT.`;
}

function updateText(model,n,m,p,sim){
  const t=theoretical(model,n,p);
  if(model==='bernoulli'){
    $('activeModelBadge').textContent='Bernoulli model';
    $('trajectoryText').innerHTML=`Every increment is either 0 or 1, so the cumulative score can never go down. The average slope is controlled by <span class="math">p=${p.toFixed(2)}</span>: over many steps we expect roughly ${Math.round(100*p)}% successful penetrations.`;
    $('distributionInsight').innerHTML=`For Bernoulli data, theory gives <span class="math">E[Sₙ]=np=${t.meanTotal.toFixed(2)}</span> and <span class="math">Var(Sₙ)=np(1-p)=${t.varTotal.toFixed(2)}</span>. Dividing by n keeps the mean at <span class="math">p</span> but compresses the variance to <span class="math">${t.varAverage.toFixed(6)}</span>. Dividing only by √n leaves variance <span class="math">p(1-p)=${t.varNormalized.toFixed(3)}</span>, while its mean grows like <span class="math">p√n</span>.`;
    $('llnInsight').innerHTML=`The curves become less erratic and approach the horizontal line <span class="math">p=${p.toFixed(2)}</span>. Formally, <span class="math">Sₙ/n → p</span> in probability. The simulation therefore turns the abstract Law of Large Numbers into something visible.`;
    $('varianceInsight').innerHTML=`Here <span class="math">σ²=p(1-p)=${t.sigma2.toFixed(3)}</span>. This number measures how much one Bernoulli step varies around its mean. When we sum many steps, those uncertainties accumulate, so <span class="math">Var(Sₙ)</span> grows with n. Dividing by n suppresses those fluctuations, which is why the average becomes stable. Dividing by √n keeps the fluctuations visible on a constant scale. This is exactly the scale we need when we want to study the shape of the remaining randomness rather than make it disappear.`;
    $('simulationSummary').innerHTML=`Current experiment: <span class="math">n=${n}</span> systems, <span class="math">m=${m}</span> attackers and <span class="math">p=${p.toFixed(2)}</span>. Theory predicts about <span class="math">${t.meanTotal.toFixed(1)}</span> successful penetrations per attacker on average; the current simulation produced <span class="math">${mean(sim.totals).toFixed(2)}</span>.`;
  } else {
    $('activeModelBadge').textContent='Rademacher model';
    $('trajectoryText').innerHTML='Every increment is +1 or -1 with equal probability. The paths therefore move both upward and downward like symmetric random walks. There is no systematic drift, but random imbalances accumulate over time.';
    $('distributionInsight').innerHTML=`For Rademacher data, <span class="math">E[Sₙ]=0</span> and <span class="math">Var(Sₙ)=n=${n}</span>. The total distribution becomes wider as n grows. The average divides those fluctuations by n and therefore concentrates near 0, while <span class="math">Sₙ/√n</span> keeps variance exactly 1 and remains non-degenerate.`;
    $('llnInsight').innerHTML='The running averages fluctuate strongly at the beginning, but the curves progressively collapse toward 0. The total score itself does not converge to 0; only the score per step does. This distinction is exactly what the Law of Large Numbers describes.';
    $('varianceInsight').innerHTML='For Rademacher increments, <span class="math">σ²=1</span>. So the uncertainty of the total score grows like <span class="math">n</span>, the uncertainty of the average shrinks like <span class="math">1/n</span>, and the uncertainty of <span class="math">Sₙ/√n</span> stays equal to 1. This is why the three normalizations answer different questions: total size, long-run average, and natural random fluctuation.';
    $('simulationSummary').innerHTML=`Current experiment: <span class="math">n=${n}</span> systems and <span class="math">m=${m}</span> attackers. The theoretical total-score mean is 0 and variance is ${n}. The observed mean is <span class="math">${mean(sim.totals).toFixed(2)}</span>, which may not be exactly zero in a finite sample but should remain small relative to n.`;
  }
}

function run(model=state.model){
  state.model=model;
  const n=+$('systems').value, m=+$('attackers').value, p=+$('probability').value;
  const sim=simulate(model,n,m,p);
  updateStats(sim);
  updateText(model,n,m,p,sim);
  updateAnalysisTable(model,n,p,sim);
  drawTrajectories(model,n,p);
  drawDistributions(sim);
  drawAverage(model,n,p);
  drawVariance(model,p);
  drawCLT(+$('cltN').value);
  drawMEffect(model,n,p);
  $('runBernoulli').classList.toggle('primary',model==='bernoulli');
  $('runRademacher').classList.toggle('primary',model==='rademacher');
}

function syncControls(){
  $('systemsValue').textContent=$('systems').value;
  $('attackersValue').textContent=$('attackers').value;
  $('probabilityValue').textContent=(+$('probability').value).toFixed(2);
}

['systems','attackers','probability'].forEach(id=>$(id).addEventListener('input',syncControls));
$('runBernoulli').addEventListener('click',()=>run('bernoulli'));
$('runRademacher').addEventListener('click',()=>run('rademacher'));
$('newSample').addEventListener('click',()=>run(state.model));
$('cltN').addEventListener('change',()=>drawCLT(+$('cltN').value));

syncControls();
run('bernoulli');
