const referenceData = [
  {z:-3.00, area:0.49865, cdf:0.00135},
  {z:-2.00, area:0.47725, cdf:0.02275},
  {z:-1.00, area:0.34134, cdf:0.15866},
  {z: 0.00, area:0.00000, cdf:0.50000},
  {z: 0.50, area:0.19146, cdf:0.69146},
  {z: 1.00, area:0.34134, cdf:0.84134},
  {z: 1.53, area:0.43699, cdf:0.93699},
  {z: 2.00, area:0.47725, cdf:0.97725},
  {z: 3.00, area:0.49865, cdf:0.99865}
];

function phi(x){
  return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
}

function cdfSimpson(z,n=400){
  if(z===0) return 0.5;
  if(n%2!==0) n++;
  const b=Math.abs(z);
  const h=b/n;
  let s=phi(0)+phi(b);
  for(let i=1;i<n;i++){
    s+=(i%2===0?2:4)*phi(i*h);
  }
  const area=s*h/3;
  return z>0 ? 0.5+area : 0.5-area;
}

function erfSeriesLimited(x,maxTerms=80,tol=1e-16){
  if(x===0) return 0;
  const sign=x<0?-1:1;
  x=Math.abs(x);

  let term=x;
  let sum=term;

  for(let n=0;n<maxTerms-1;n++){
    term *= -x*x*(2*n+1)/((n+1)*(2*n+3));
    sum += term;
    if(Math.abs(term)<tol) break;
  }
  return sign*(2/Math.sqrt(Math.PI))*sum;
}

function cdfSeries(z,maxTerms=80){
  return 0.5*(1+erfSeriesLimited(z/Math.sqrt(2),maxTerms));
}

// Abramowitz & Stegun 7.1.26
function erfAS(x){
  const sign=x<0?-1:1;
  x=Math.abs(x);
  const p=0.3275911;
  const a1=0.254829592;
  const a2=-0.284496736;
  const a3=1.421413741;
  const a4=-1.453152027;
  const a5=1.061405429;
  const t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t)*Math.exp(-x*x);
  return sign*y;
}

function cdfErfAS(z){
  return 0.5*(1+erfAS(z/Math.sqrt(2)));
}

function fmt(x,d=8){
  return Number.isFinite(x)?x.toFixed(d):"–";
}
function err(x,y){ return Math.abs(x-y); }

function prepCanvas(canvas){
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  const cssW=Math.max(320,rect.width);
  const cssH=parseFloat(getComputedStyle(canvas).height)||390;
  canvas.width=Math.round(cssW*dpr);
  canvas.height=Math.round(cssH*dpr);
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w:cssW,h:cssH};
}

function drawNormal(canvas,z=1){
  const {ctx,w,h}=prepCanvas(canvas);
  ctx.clearRect(0,0,w,h);

  const L=55,R=22,T=24,B=45;
  const pw=w-L-R, ph=h-T-B;
  const xmin=-4,xmax=4,ymax=0.43;
  const X=x=>L+(x-xmin)/(xmax-xmin)*pw;
  const Y=y=>T+ph-y/ymax*ph;

  ctx.strokeStyle="#dfe6f0"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(L,Y(0)); ctx.lineTo(w-R,Y(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0),T); ctx.lineTo(X(0),T+ph); ctx.stroke();

  // Shade CDF area
  ctx.beginPath();
  ctx.moveTo(X(xmin),Y(0));
  const zcap=Math.max(xmin,Math.min(xmax,z));
  const steps=240;
  for(let i=0;i<=steps;i++){
    const x=xmin+(zcap-xmin)*i/steps;
    ctx.lineTo(X(x),Y(phi(x)));
  }
  ctx.lineTo(X(zcap),Y(0));
  ctx.closePath();
  ctx.fillStyle="rgba(37,99,235,.18)";
  ctx.fill();

  // Bell curve
  ctx.beginPath();
  for(let i=0;i<=400;i++){
    const x=xmin+(xmax-xmin)*i/400;
    const px=X(x), py=Y(phi(x));
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.strokeStyle="#172033"; ctx.lineWidth=2.2; ctx.stroke();

  // z line
  if(z>=xmin && z<=xmax){
    ctx.setLineDash([6,5]);
    ctx.beginPath();ctx.moveTo(X(z),Y(0));ctx.lineTo(X(z),Y(phi(z)));
    ctx.strokeStyle="#2563eb";ctx.lineWidth=2;ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle="#61708a";ctx.font="12px system-ui";
  [-4,-3,-2,-1,0,1,2,3,4].forEach(v=>{
    ctx.fillText(String(v),X(v)-4,h-19);
  });
  ctx.fillStyle="#172033";ctx.font="600 13px system-ui";
  ctx.fillText("standard normal density φ(x)",L+10,T+15);
  ctx.fillStyle="#2563eb";
  ctx.fillText("shaded area = Φ(z)",L+10,T+34);
}

function drawErrorPlot(){
  const canvas=document.getElementById("errorCanvas");
  const {ctx,w,h}=prepCanvas(canvas);
  ctx.clearRect(0,0,w,h);

  const L=65,R=20,T=25,B=55,pw=w-L-R,ph=h-T-B;
  const methods=[
    {name:"Simpson", color:"#2563eb", vals:referenceData.map(d=>Math.max(err(cdfSimpson(d.z,400),d.cdf),1e-10))},
    {name:"Series", color:"#d98200", vals:referenceData.map(d=>Math.max(err(cdfSeries(d.z,80),d.cdf),1e-10))},
    {name:"erf approx.", color:"#149b72", vals:referenceData.map(d=>Math.max(err(cdfErfAS(d.z),d.cdf),1e-10))}
  ];
  const ymin=1e-10,ymax=1e-3;
  const log10=x=>Math.log(x)/Math.LN10;
  const X=i=>L+i/(referenceData.length-1)*pw;
  const Y=v=>T+(log10(ymax)-log10(v))/(log10(ymax)-log10(ymin))*ph;

  ctx.strokeStyle="#dfe6f0";ctx.lineWidth=1;
  for(let p=-10;p<=-3;p++){
    const y=Y(Math.pow(10,p));
    ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();
    ctx.fillStyle="#61708a";ctx.font="11px system-ui";
    ctx.fillText("1e"+p,8,y+4);
  }

  methods.forEach(m=>{
    ctx.beginPath();
    m.vals.forEach((v,i)=>{
      const x=X(i),y=Y(v);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.strokeStyle=m.color;ctx.lineWidth=2;ctx.stroke();
    m.vals.forEach((v,i)=>{
      ctx.beginPath();ctx.arc(X(i),Y(v),3,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();
    });
  });

  referenceData.forEach((d,i)=>{
    ctx.fillStyle="#61708a";ctx.font="11px system-ui";
    ctx.fillText(String(d.z),X(i)-9,h-22);
  });

  let lx=L;
  methods.forEach(m=>{
    ctx.fillStyle=m.color;ctx.fillRect(lx,T,14,3);
    ctx.fillStyle="#172033";ctx.font="12px system-ui";
    ctx.fillText(m.name,lx+20,T+5);
    lx+=120;
  });
  ctx.fillText("z",w/2,h-5);
}

function fillSourceTable(){
  const b=document.getElementById("sourceTableBody");
  referenceData.forEach(d=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${d.z.toFixed(2)}</td><td>${d.area.toFixed(5)}</td><td>${d.cdf.toFixed(5)}</td>`;
    b.appendChild(tr);
  });
}

function fillExperiment(){
  const b=document.getElementById("experimentBody");
  referenceData.forEach(d=>{
    const s=cdfSimpson(d.z,400);
    const ps=cdfSeries(d.z,80);
    const ea=cdfErfAS(d.z);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${d.z.toFixed(2)}</td>
      <td>${d.cdf.toFixed(5)}</td>
      <td>${fmt(s)}</td><td>${err(s,d.cdf).toExponential(2)}</td>
      <td>${fmt(ps)}</td><td>${err(ps,d.cdf).toExponential(2)}</td>
      <td>${fmt(ea)}</td><td>${err(ea,d.cdf).toExponential(2)}</td>`;
    b.appendChild(tr);
  });
}

function fillConvergence(){
  const target=1.53, ref=0.93699;
  const sb=document.getElementById("simpsonConvergence");
  [4,8,16,32,64,128,256].forEach(n=>{
    const v=cdfSimpson(target,n);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${n}</td><td>${fmt(v)}</td><td>${err(v,ref).toExponential(3)}</td>`;
    sb.appendChild(tr);
  });

  const pb=document.getElementById("seriesConvergence");
  [2,3,4,5,7,10,15,25].forEach(n=>{
    const v=cdfSeries(target,n);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${n}</td><td>${fmt(v)}</td><td>${err(v,ref).toExponential(3)}</td>`;
    pb.appendChild(tr);
  });
}

function updateInteractive(){
  const z=Number(document.getElementById("zSlider").value);
  document.getElementById("zLabel").textContent=z.toFixed(2);
  const s=cdfSimpson(z,400);
  const ps=cdfSeries(z,80);
  const ea=cdfErfAS(z);

  document.getElementById("simpsonLive").textContent=fmt(s);
  document.getElementById("seriesLive").textContent=fmt(ps);
  document.getElementById("erfLive").textContent=fmt(ea);
  drawNormal(document.getElementById("interactiveCanvas"),z);

  const spread=Math.max(s,ps,ea)-Math.min(s,ps,ea);
  let msg;
  if(Math.abs(z)<0.4){
    msg="Near the center, Φ(z) is close to 0.5. The power series is particularly efficient here because its terms shrink rapidly.";
  }else if(Math.abs(z)>2.5){
    msg="In the tails, Φ(z) is already very close to 0 or 1. Absolute errors may look tiny even though the remaining tail probability is itself tiny.";
  }else{
    msg="In the central region all three algorithms agree closely. The main practical difference is how much work each one performs.";
  }
  document.getElementById("interactiveText").innerHTML=
    `<strong>What should we notice?</strong> ${msg}<br>Current spread between the three computed values: <strong>${spread.toExponential(3)}</strong>.`;
}

function runBenchmark(){
  const zs=[];
  for(let i=0;i<3000;i++) zs.push(-3+6*i/2999);
  let sink=0;

  let t0=performance.now();
  zs.forEach(z=>sink+=cdfSimpson(z,120));
  let t1=performance.now();

  let t2=performance.now();
  zs.forEach(z=>sink+=cdfSeries(z,80));
  let t3=performance.now();

  let t4=performance.now();
  zs.forEach(z=>sink+=cdfErfAS(z));
  let t5=performance.now();

  document.getElementById("benchSimpson").textContent=(t1-t0).toFixed(2)+" ms";
  document.getElementById("benchSeries").textContent=(t3-t2).toFixed(2)+" ms";
  document.getElementById("benchErf").textContent=(t5-t4).toFixed(2)+" ms";
  document.getElementById("benchmarkText").innerHTML=
    "<strong>Interpretation.</strong> The exact milliseconds are machine-dependent. Compare the methods only within this run. Simpson evaluates the density many times for every z, while the erf approximation performs a fixed short calculation.";
  window.__benchmarkSink=sink;
}

function init(){
  fillSourceTable();
  fillExperiment();
  fillConvergence();
  drawNormal(document.getElementById("meaningCanvas"),1);
  updateInteractive();
  drawErrorPlot();

  document.getElementById("zSlider").addEventListener("input",updateInteractive);
  document.getElementById("runBenchmark").addEventListener("click",runBenchmark);
  window.addEventListener("resize",()=>{
    drawNormal(document.getElementById("meaningCanvas"),1);
    updateInteractive();
    drawErrorPlot();
  });
}
document.addEventListener("DOMContentLoaded",init);
