const defs = {
  sin:{label:"sin(x)",a:0,b:Math.PI,exact:2,f:x=>Math.sin(x),ymin:0,ymax:1.08},
  square:{label:"x²",a:0,b:1,exact:1/3,f:x=>x*x,ymin:0,ymax:1.08},
  step:{label:"step",a:0,b:1,exact:2,f:x=>x<.5?1:3,ymin:0,ymax:3.25},
  abs:{label:"|x−0.5|",a:0,b:1,exact:.25,f:x=>Math.abs(x-.5),ymin:0,ymax:.55},
  invroot:{label:"1/√x",a:0,b:1,exact:2,f:x=>1/Math.sqrt(Math.max(x,1e-12)),ymin:0,ymax:8},
  indicator:{label:"indicator",a:0,b:1,exact:.5,f:x=>x<.5?1:0,ymin:0,ymax:1.08},
  sinc:{label:"sin(x)/x",a:0,b:Math.PI,exact:1.851937051982466,f:x=>Math.abs(x)<1e-10?1:Math.sin(x)/x,ymin:0,ymax:1.08}
};
let rChart,lChart;
function fmt(x){return Number.isFinite(x)?x.toFixed(6):"–";}
function riemannApprox(d,n){
  const dx=(d.b-d.a)/n; let sum=0; const bars=[];
  for(let i=0;i<n;i++){const x=d.a+(i+.5)*dx;const y=d.f(x);sum+=y*dx;bars.push({x,y});}
  return {value:sum,bars};
}
function lebesgueApprox(d,k){
  const samples=10000,pts=[]; let min=Infinity,max=-Infinity;
  for(let i=0;i<samples;i++){const x=d.a+(i+.5)*(d.b-d.a)/samples;const y=d.f(x);pts.push({x,y});min=Math.min(min,y);max=Math.max(max,y);}
  const width=(max-min)/k||1,counts=new Array(k).fill(0);
  pts.forEach(p=>{let band=Math.floor((p.y-min)/width);if(band>=k)band=k-1;p.band=band;counts[band]++;});
  let sum=0;
  for(let j=0;j<k;j++){const value=min+(j+.5)*width;const measure=(counts[j]/samples)*(d.b-d.a);sum+=value*measure;}
  return {value:sum,pts,samples};
}
function curveData(d){
  const out=[];
  for(let i=0;i<=450;i++){let x=d.a+(d.b-d.a)*i/450;if(d===defs.invroot&&i===0)x=.0001;let y=d.f(x);if(d===defs.invroot)y=Math.min(y,8);out.push({x,y});}
  return out;
}
function colorBand(j,k){const hue=145+(j/Math.max(1,k-1))*85;return `hsla(${hue},68%,48%,.75)`;}
function update(){
  const key=document.getElementById("functionSelect").value,d=defs[key];
  const n=+document.getElementById("nRange").value,k=+document.getElementById("kRange").value;
  document.getElementById("nValue").textContent=n;document.getElementById("kValue").textContent=k;
  const r=riemannApprox(d,n),l=lebesgueApprox(d,k);
  document.getElementById("exactValue").textContent=fmt(d.exact);
  document.getElementById("riemannValue").textContent=fmt(r.value);
  document.getElementById("lebesgueValue").textContent=fmt(l.value);
  document.getElementById("riemannError").textContent=fmt(Math.abs(r.value-d.exact));
  document.getElementById("lebesgueError").textContent=fmt(Math.abs(l.value-d.exact));
  const messages={
    sin:"Both views behave smoothly because the function itself is smooth.",
    square:"This is a clean benchmark: any difference mainly comes from the numerical approximation.",
    step:"Lebesgue is conceptually very natural here because the function has only two values.",
    abs:"The same value appears at different x-locations, which highlights the role of grouping by value.",
    invroot:"The function becomes very large near zero, but those large values occupy very little horizontal space.",
    indicator:"This function directly connects integration with the size of a set.",
    sinc:"Changing one point does not change the integral, which is a useful measure-theoretic idea."
  };
  document.getElementById("labExplanation").innerHTML=`<strong>What should we notice?</strong> ${messages[key]} With the current settings, Riemann gives ${fmt(r.value)} and the Lebesgue-inspired method gives ${fmt(l.value)}.`;
  if(rChart)rChart.destroy(); if(lChart)lChart.destroy();
  rChart=new Chart(document.getElementById("riemannChart"),{
    data:{datasets:[
      {type:"bar",label:"Riemann rectangles",data:r.bars.map(p=>({x:p.x,y:d===defs.invroot?Math.min(p.y,8):p.y})),parsing:false,backgroundColor:"rgba(37,99,235,.20)",borderColor:"rgba(37,99,235,.55)",borderWidth:1,barThickness:Math.max(2,600/r.bars.length)},
      {type:"line",label:d.label,data:curveData(d),parsing:false,borderColor:"#1f2937",borderWidth:2,pointRadius:0}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{type:"linear",min:d.a,max:d.b},y:{min:d.ymin,max:d.ymax}},plugins:{legend:{position:"bottom"}}}
  });
  const stride=Math.max(1,Math.floor(l.pts.length/900));
  const shown=l.pts.filter((_,i)=>i%stride===0).map(p=>({x:p.x,y:d===defs.invroot?Math.min(p.y,8):p.y,band:p.band}));
  lChart=new Chart(document.getElementById("lebesgueChart"),{
    type:"scatter",
    data:{datasets:[{label:"Points grouped by value",data:shown,parsing:false,pointRadius:2.2,pointBackgroundColor:shown.map(p=>colorBand(p.band,k)),pointBorderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{type:"linear",min:d.a,max:d.b},y:{min:d.ymin,max:d.ymax}},plugins:{legend:{position:"bottom"}}}
  });
}
function gcd(a,b){while(b){[a,b]=[b,a%b]}return a;}
function renderThomae(){
  const box=document.getElementById("thomaeDemo");
  for(let q=1;q<=28;q++){for(let p=0;p<=q;p++){if(gcd(p,q)!==1)continue;const dot=document.createElement("div");dot.className="dot";dot.style.left=((p/q)*100)+"%";dot.style.bottom=((1/q)*100)+"%";box.appendChild(dot);}}
}
["functionSelect","nRange","kRange"].forEach(id=>document.getElementById(id).addEventListener("input",update));
renderThomae();update();
