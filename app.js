"use strict";
// Homework 2 educational cryptography prototype.
// Curve and scalar multiplication use the same parameters as Homework 1.
const p=17,G=[1,5],O=null;
const $=id=>document.getElementById(id);
const mod=x=>((x%p)+p)%p;
function inv(x){for(let i=1;i<p;i++)if(mod(x*i)===1)return i;throw Error('No inverse');}
const equal=(a,b)=>a===b||(!!a&&!!b&&a[0]===b[0]&&a[1]===b[1]);
function add(P,Q){if(!P)return Q;if(!Q)return P;const [x1,y1]=P,[x2,y2]=Q;if(x1===x2&&mod(y1+y2)===0)return O;const m=equal(P,Q)?mod(3*x1*x1*inv(2*y1)):mod((y2-y1)*inv(x2-x1));const x3=mod(m*m-x1-x2);return [x3,mod(m*(x1-x3)-y1)];}
function mul(k,P){let R=O,Q=P;for(;k>0;k=Math.floor(k/2),Q=add(Q,Q))if(k%2)R=add(R,Q);return R;}
const point=P=>P?`(${P[0]}, ${P[1]})`:'O';
function caesar(text,key){return text.toUpperCase().replace(/[A-Z]/g,c=>String.fromCharCode(65+(c.charCodeAt(0)-65+key+260)%26));}
function renderCaesarDetails(message,key){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  $('alphabetplain').replaceChildren();$('alphabetcipher').replaceChildren();
  for(let i=0;i<26;i++){
    const original=document.createElement('div');original.className='alphabet-cell';original.textContent=alphabet[i];
    const shifted=document.createElement('div');shifted.className='alphabet-cell';shifted.textContent=alphabet[(i+key)%26];
    $('alphabetplain').append(original);$('alphabetcipher').append(shifted);
  }
  $('shiftcaption').textContent=`Every letter moves ${key} position${key===1?'':'s'} · A → ${alphabet[key]}`;
  const letters=$('lettersteps');letters.replaceChildren();
  const chars=Array.from(message.toUpperCase()).slice(0,100);
  let firstLetter=null;
  for(const [i,c] of chars.entries()){
    if(!/^[A-Z]$/.test(c)){
      const sep=document.createElement('span');sep.className='letter-tile separator';sep.textContent=c===' '?'·':c;sep.title='Not shifted';letters.append(sep);continue;
    }
    const code=c.charCodeAt(0)-65, mapped=alphabet[(code+key)%26];
    const tile=document.createElement('button');tile.type='button';tile.className='letter-tile';tile.setAttribute('aria-label',`${c} shifted by ${key} becomes ${mapped}`);
    const from=document.createElement('span');from.className='from';from.textContent=c;
    const arrow=document.createElement('span');arrow.className='tile-arrow';arrow.textContent='↓ +'+key;
    const to=document.createElement('span');to.className='to';to.textContent=mapped;
    tile.append(from,arrow,to);
    tile.addEventListener('click',()=>{
      letters.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
      tile.classList.add('selected');
      $('letterhelp').textContent=`${c} = ${code}; (${code} + ${key}) mod 26 = ${(code+key)%26}; result = ${mapped}. To decrypt: (${(code+key)%26} − ${key}) mod 26 = ${code} = ${c}.`;
    });
    letters.append(tile);if(!firstLetter)firstLetter=tile;
  }
  if(message.length>100){const hint=document.createElement('span');hint.className='muted';hint.textContent='Showing first 100 characters';letters.append(hint);}
  if(firstLetter)firstLetter.click();else $('letterhelp').textContent='Type a letter to see the shift calculation.';
}
function maskByte(S,i){return (17*S[0]+31*S[1]+13*i)%256;}
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(' ');}
const frequencies=[8.167,1.492,2.782,4.253,12.702,2.228,2.015,6.094,6.966,.153,.772,4.025,2.406,6.749,7.507,1.929,.095,5.987,6.327,9.056,2.758,.978,2.360,.150,1.974,.074];
const totalFreq=frequencies.reduce((a,b)=>a+b,0);
function chi2(text){const counts=Array(26).fill(0),letters=text.toUpperCase().match(/[A-Z]/g)||[];for(const c of letters)counts[c.charCodeAt(0)-65]++;const N=letters.length;if(!N)return Infinity;return counts.reduce((acc,x,i)=>{const e=N*frequencies[i]/totalFreq;return acc+(x-e)**2/e;},0);}
function caesarAttack(cipher){return Array.from({length:26},(_,k)=>({k,score:chi2(caesar(cipher,-k)),plain:caesar(cipher,-k)})).sort((a,b)=>a.score-b.score);}
function renderByteLab(){
 const v=eccData(),raw=new TextEncoder().encode(v.msg),count=raw.length;
 const slider=$('byteposition');slider.max=String(Math.max(0,count-1));
 if(Number(slider.value)>=count)slider.value=String(Math.max(0,count-1));
 const i=Number(slider.value),b=count?raw[i]:0,m=maskByte(v.S1,i),c=b^m;
 const bits=x=>x.toString(2).padStart(8,'0'),hx=x=>'0x'+x.toString(16).padStart(2,'0').toUpperCase();
 $('byteindex').textContent=count?`${i + 1} / ${count}`:'No bytes';
 $('bytenext').disabled=!count;
 $('bytechar').textContent=count?(b>=32&&b<127?String.fromCharCode(b):'·'):'—';
 $('byteplainhex').textContent=count?hx(b):'—';$('byteplainbits').textContent=count?bits(b):'--------';
 $('bytemasknum').textContent=count?m:'—';$('bytemaskhex').textContent=count?hx(m):'—';$('bytemaskbits').textContent=count?bits(m):'--------';
 $('byteciphernum').textContent=count?c:'—';$('bytecipherhex').textContent=count?hx(c):'—';$('bytecipherbits').textContent=count?bits(c):'--------';
 $('byteexplanation').textContent=count?`At byte ${i + 1}, Alice computes mask = (17 × ${v.S1[0]} + 31 × ${v.S1[1]} + 13 × ${i}) mod 256 = ${m}. Encryption: ${b} XOR ${m} = ${c}. Bob performs ${c} XOR ${m} = ${b}.`:'Type a message in the Caesar laboratory above to inspect its encrypted bytes.';
}
$('byteposition').addEventListener('input',renderByteLab);
$('bytenext').addEventListener('click',()=>{const slider=$('byteposition');slider.value=String(Number(slider.value)>=Number(slider.max)?0:Number(slider.value)+1);renderByteLab();});
function update(){const message=$('message').value,shift=Number($('shift').value),d=Number($('privatekey').value),r=Number($('ephemeral').value);$('shiftval').textContent=shift;$('caesarplain').textContent=message.toUpperCase();$('caesarcipher').textContent=caesar(message,shift);$('caesardec').textContent=caesar(caesar(message,shift),-shift);renderCaesarDetails(message,shift);const Q=mul(d,G),R=mul(r,G),S1=mul(r,Q),S2=mul(d,R),raw=new TextEncoder().encode(message),ct=raw.map((v,i)=>v^maskByte(S1,i)),dec=ct.map((v,i)=>v^maskByte(S2,i));$('eccpub').textContent=point(Q);$('eccR').textContent=point(R);$('eccS1').textContent=point(S1);$('eccS2').textContent=point(S2);$('eccagree').textContent=equal(S1,S2)?'MATCH ✓':'MISMATCH';$('eccbytes').textContent=hex(raw);$('ecchex').textContent=hex(ct);$('eccdec').textContent=new TextDecoder().decode(dec);$('truekey').textContent=shift;if($('eccstagecount'))showEccStage();renderByteLab();renderProperties(message,shift,raw,ct);interpretOutput();return {Q,R,d,shift,ct};}
// Statistical-properties lab: observed distributions, not security claims.
function empirical(counts){
 const n=counts.reduce((a,b)=>a+b,0);
 if(!n)return {n:0,h:0,ic:0,distinct:0};
 let h=0,matching=0,distinct=0;
 for(const c of counts){if(!c)continue;distinct++;const p=c/n;h-=p*Math.log2(p);matching+=c*(c-1);}
 return {n,h,ic:n>1?matching/(n*(n-1)):0,distinct};
}
function drawLetterPairs(target,a,b){
 target.replaceChildren();const max=Math.max(1,...a,...b),letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 for(let i=0;i<26;i++){
  const col=document.createElement('div');col.className='freq-col';col.title=`${letters[i]}: plaintext ${a[i]}, Caesar ${b[i]}`;
  const pair=document.createElement('div');pair.className='freq-pair';
  for(const [num,cl] of [[a[i],'source'],[b[i],'target']]){
   const bar=document.createElement('div');bar.className=`freq-bar ${cl}`;
   bar.style.height=`${Math.max(num?3:0,100*num/max)}%`;pair.append(bar);
  }
  const label=document.createElement('small');label.textContent=letters[i];col.append(pair,label);target.append(col);
 }
}
function drawBytePairs(target,a,b){
 target.replaceChildren();const selected=Array.from({length:256},(_,i)=>i).filter(i=>a[i]||b[i]).sort((i,j)=>Math.max(a[j],b[j])-Math.max(a[i],b[i])||i-j).slice(0,16).sort((i,j)=>i-j);
 const max=Math.max(1,...selected.map(i=>a[i]),...selected.map(i=>b[i]));
 for(const i of selected){
  const col=document.createElement('div');col.className='byte-freq-item';
  const label=document.createElement('span');label.textContent=i.toString(16).padStart(2,'0').toUpperCase();
  const bar1=document.createElement('div');bar1.className='byte-freq-track';const fill1=document.createElement('div');fill1.className='byte-freq-fill source';fill1.style.width=`${100*a[i]/max}%`;bar1.append(fill1);
  const bar2=document.createElement('div');bar2.className='byte-freq-track';const fill2=document.createElement('div');fill2.className='byte-freq-fill target';fill2.style.width=`${100*b[i]/max}%`;bar2.append(fill2);
  const val=document.createElement('small');val.textContent=`${a[i]} / ${b[i]}`;
  col.title=`Byte 0x${label.textContent}: plaintext ${a[i]}, ciphertext ${b[i]}`;col.append(label,bar1,bar2,val);target.append(col);
 }
 if(!selected.length)target.textContent='Enter a message to see its byte distribution.';
}
function renderProperties(message,shift,raw,ct){
 const letters=(message.toUpperCase().match(/[A-Z]/g)||[]).join('');
 const caesarText=caesar(letters,shift),l1=Array(26).fill(0),l2=Array(26).fill(0),b1=Array(256).fill(0),b2=Array(256).fill(0);
 for(const c of letters)l1[c.charCodeAt(0)-65]++;
 for(const c of caesarText)l2[c.charCodeAt(0)-65]++;
 for(const x of raw)b1[x]++;
 for(const x of ct)b2[x]++;
 drawLetterPairs($('caesardistribution'),l1,l2);drawBytePairs($('eccdistribution'),b1,b2);
 const lA=empirical(l1),lB=empirical(l2),eA=empirical(b1),eB=empirical(b2);
 $('caesarmetrics').textContent=`${lA.n} letters · entropy ${lA.h.toFixed(2)} → ${lB.h.toFixed(2)} bits/letter · coincidence ${lA.ic.toFixed(3)} → ${lB.ic.toFixed(3)}`;
 $('eccmetrics').textContent=`${eA.n} bytes · empirical entropy ${eA.h.toFixed(2)} → ${eB.h.toFixed(2)} bits/byte · coincidence ${eA.ic.toFixed(3)} → ${eB.ic.toFixed(3)}`;
 $('propertyinterpretation').textContent=letters.length<30?'This is a short sample: individual bars and empirical metrics may fluctuate substantially. Caesar still preserves the exact multiset of letter counts, regardless of length. Try a longer sentence for a clearer language-frequency pattern.':`For ${letters.length} letters, Caesar preserves the empirical entropy exactly (${lA.h.toFixed(2)} bits/letter): the counts are relabeled, not removed. In contrast, the ECC demo’s byte frequencies change according to our specific deterministic XOR mask; this does not establish cryptographic randomness or security.`;
}
// Guided ECC exchange. Values come from the same key and message inputs as the laboratory.
let eccStage=0, eccTimer=null;
const eccStages=[
 {tag:'HOMEWORK 1 RECAP',title:'1. First, generate the public key — no encryption yet',packet:'Q = kG',direction:'PUBLIC POINT',alice:'Knows G and public Q',bob:'Keeps private k',eve:'Sees Q and G, as she is allowed to.',description:'This is exactly our Homework 1: Bob chooses a private integer k and multiplies generator G to obtain the public key Q. Notice that the message has not been touched.',formula:v=>`PRIVATE k = ${v.d}    PUBLIC Q = ${v.d}G = ${point(v.Q)}`,insight:'The point Q is public, not a ciphertext. Sending the plaintext now would reveal it.'},
 {tag:'WHY ENCRYPT?',title:'2. What happens if we send the message now?',packet:'PLAINTEXT',direction:'READABLE TO EVE',alice:'Has readable data',bob:'Has not decrypted anything',eve:'Can read plaintext if Alice sends it directly.',description:'Alice wants to send the message. If she transmits the message as it is, Eve can intercept the exact same words. A public-key calculation alone does not protect network data.',formula:v=>`Message before encryption: ${v.msg.slice(0,42)}${v.msg.length>42?'…':''}`,insight:'This is the missing problem: we need to transform the message, not hide G or Q.'},
 {tag:'ECC CONNECTION',title:'3. Alice computes a point only Bob can reproduce (in the intended design)',packet:'R = rG',direction:'PUBLIC R',alice:'Calculates R and S',bob:'Will receive R',eve:'Sees G, Q and R, but not k or r.',description:'Alice uses the public key Q from Homework 1. She chooses temporary r, computes R = rG and S = rQ. Bob will be able to compute the very same S using private k and received R.',formula:v=>`R = ${v.r}G = ${point(v.R)}    S = ${v.r}Q = ${point(v.S1)}`,insight:'Here ECC provides a shared point S. We still have NOT encrypted the message.'},
 {tag:'ACTUAL ENCRYPTION',title:'4. This is where the message is encrypted',packet:'CIPHERTEXT + R',direction:'ENCRYPTED BYTES SENT',alice:'Transforms message bytes',bob:'Receives R and ciphertext',eve:'Sees only the transmitted bytes and public R (toy security is weak).',description:'Now, and only now, Alice converts the message to UTF-8 bytes and XORs them with a toy mask computed from S. The result is ciphertext. She transmits the ciphertext and R.',formula:v=>`Plaintext → UTF-8 bytes → XOR mask from S → ${hex(v.ct).slice(0,58)}${v.ct.length>20?'…':''}`,insight:'Q = kG generated a public key; the mask derived from S transforms the actual data.'},
 {tag:'BOB DECRYPTS',title:'5. Bob recreates the shared point and reverses XOR',packet:'S = kR = rQ',direction:'BOB RECOVERS MESSAGE',alice:'Has never sent S',bob:'Uses his private k',eve:'Can intercept traffic, and can brute-force this tiny toy curve.',description:'Bob multiplies the public R by his private k: kR = krG = rkG = rQ = S. He derives the same toy byte mask and XORs the ciphertext again, recovering the original message.',formula:v=>`Alice S = ${point(v.S1)}    Bob S = ${point(v.S2)}    Recovered: ${v.msg.slice(0,32)}${v.msg.length>32?'…':''}`,insight:'The shared point connects the two operations: Alice encrypts; Bob decrypts.'},
 {tag:'SECURITY LESSON',title:'6. Correct encryption does not imply secure encryption',packet:'Q · R · CIPHERTEXT',direction:'EVE CAN ATTACK',alice:'Has followed the procedure',bob:'Has recovered plaintext',eve:'Can try all 8 toy private keys to recover k.',description:'Our Homework 1 generator has order 9, so its nonzero private-key classes are only 1 through 8. Eve can test every k against public Q, recreate S and decrypt. This explains why the same mathematical procedure needs strong parameters and a secure encryption construction.',formula:v=>`Public Q = ${point(v.Q)}    Candidate keys = {1,2,3,4,5,6,7,8}`,insight:'The point is to understand how encryption is added — and then experimentally discover why this toy scheme is insecure.'}
];
function eccData(){const d=Number($('privatekey').value),r=Number($('ephemeral').value),msg=$('message').value,Q=mul(d,G),R=mul(r,G),S1=mul(r,Q),S2=mul(d,R);const ct=new TextEncoder().encode(msg).map((b,i)=>b^maskByte(S1,i));return {d,r,msg,Q,R,S1,S2,ct};}

// A visible calculation accompanies every conceptual step of the ECC story.
function walkCard(label,value,kind=''){
 const card=document.createElement('div');card.className='walk-card '+kind;
 const caption=document.createElement('span');caption.textContent=label;
 const val=document.createElement('strong');val.textContent=value;
 card.append(caption,val);return card;
}
function setWalkthrough(v){
 const root=$('walkmath'),bits=$('walkbits');root.replaceChildren();bits.replaceChildren();
 const raw=new TextEncoder().encode(v.msg), b=raw.length?raw[0]:0, m=maskByte(v.S1,0), c=b^m;
 const binary=n=>n.toString(2).padStart(8,'0');
 const hexByte=n=>'0x'+n.toString(16).padStart(2,'0').toUpperCase();
 const rows=[
  {phase:'KEY GENERATION',why:'Generate a public point without changing the message.',take:'We know G and Q. The message is still readable; k is kept private.',cards:[['Private k (Bob)',String(v.d),'private'],['Generator G',point(G),'public'],['Q = kG',point(v.Q),'public']]},
  {phase:'THE PROBLEM',why:'A public key is not an encrypted message.',take:'Eve could read these exact words if Alice transmitted them without encryption.',cards:[['Readable message',v.msg||'(empty)','private'],['Public key Q',point(v.Q),'public'],['Data protection','NOT YET','warning']]},
  {phase:'ECC SHARED POINT',why:'Alice creates a point that Bob can reproduce using his secret.',take:'R is transmitted publicly; r and S are not. The message has still NOT been encrypted.',cards:[['Temporary r (Alice)',String(v.r),'private'],['R = rG',point(v.R),'public'],['S = rQ',point(v.S1),'private']]},
  {phase:'ACTUAL ENCRYPTION',why:'Here the plaintext is transformed into ciphertext.',take:'The XOR result is the encrypted first byte. The complete ciphertext and R are transmitted.',cards:[['UTF-8 first byte',raw.length?hexByte(b):'No bytes',''],['Toy mask from S',hexByte(m),'private'],['Encrypted byte',raw.length?hexByte(c):'No bytes','highlight']]},
  {phase:'DECRYPTION',why:'Bob independently obtains the same point and reverses XOR.',take:'XOR with the same mask recovers the original byte and, repeated for all bytes, the full message.',cards:[['Bob computes kR',point(v.S2),'private'],['Alice computed rQ',point(v.S1),'private'],['Recovered message',v.msg||'(empty)','highlight']]},
  {phase:'SECURITY CHECK',why:'This very small subgroup is easy to brute-force.',take:'The operation is correct but insecure: an attacker can test k = 1 to 8 using the public Q.',cards:[['Generator order','9','warning'],['Possible nonzero k','8','warning'],['Attacker knows','G, Q, R, ciphertext','public']]}
 ];
 const row=rows[eccStage];$('walkphase').textContent=row.phase;$('walkwhy').textContent=row.why;$('walktakeaway').textContent=row.take;
 row.cards.forEach(([label,value,kind])=>root.append(walkCard(label,value,kind)));
 if(eccStage===3||eccStage===4){
  const x=eccStage===3?b:c,y=m,z=eccStage===3?c:b;
  const names=eccStage===3?['PLAINTEXT','XOR MASK','CIPHERTEXT']:['CIPHERTEXT','SAME MASK','PLAINTEXT'];
  bits.classList.add('visible');
  [x,y,z].forEach((n,i)=>{
   if(i) {const op=document.createElement('span');op.className='walk-op';op.textContent=i===1?'⊕':'=';bits.append(op);}
   const item=document.createElement('div');item.className='walk-binary'+(i===2?' answer':'');
   const cap=document.createElement('small');cap.textContent=names[i];
   const value=document.createElement('strong');value.textContent=raw.length?binary(n):'--------';
   const dec=document.createElement('span');dec.textContent=raw.length?hexByte(n):'No byte';item.append(cap,value,dec);bits.append(item);
  });
 }else bits.classList.remove('visible');
}
function showEccStage(){const v=eccData(),s=eccStages[eccStage];$('eccstagecount').textContent=`STEP ${eccStage+1} OF ${eccStages.length}`;$('eccstagetype').textContent=s.tag;$('eccstagetitle').textContent=s.title;$('eccstagedesc').textContent=s.description;$('eccstageformula').textContent=s.formula(v);$('eccstageinsight').textContent=s.insight;$('eccpacket').textContent=s.packet;$('eccdirection').textContent=s.direction;$('aliceinfo').textContent=s.alice;$('bobinfo').textContent=s.bob;$('eveinfo').textContent=s.eve;$('eccprogress').replaceChildren();for(let i=0;i<eccStages.length;i++){const dot=document.createElement('span');dot.className='ecc-progress-dot'+(i<=eccStage?' completed':'')+(i===eccStage?' current':'');$('eccprogress').append(dot);}setWalkthrough(v);$('eccprev').disabled=eccStage===0;$('eccnext').disabled=eccStage===eccStages.length-1;}
function stopEccPlay(){if(eccTimer!==null){clearInterval(eccTimer);eccTimer=null;}$('eccplay').textContent='▶ Play guided explanation';}
$('eccprev').addEventListener('click',()=>{stopEccPlay();eccStage=Math.max(0,eccStage-1);showEccStage();});
$('eccnext').addEventListener('click',()=>{stopEccPlay();eccStage=Math.min(eccStages.length-1,eccStage+1);showEccStage();});
$('eccreset').addEventListener('click',()=>{stopEccPlay();eccStage=0;showEccStage();});
$('eccplay').addEventListener('click',()=>{if(eccTimer!==null){stopEccPlay();return;}if(eccStage===eccStages.length-1)eccStage=0;showEccStage();$('eccplay').textContent='Ⅱ Pause explanation';eccTimer=setInterval(()=>{if(eccStage===eccStages.length-1){stopEccPlay();return;}eccStage++;showEccStage();},6300);});

let attackText='',attackTruth='',attackKey=3,attackCursor=0,attackTimer=null;
function attackStop(){if(attackTimer!==null){clearInterval(attackTimer);attackTimer=null;}$('attackplay').textContent='▶ Auto-play';}
function attackSet(text,truth,key){attackStop();attackText=text;attackTruth=truth;attackKey=key;attackCursor=0;$('attackknownplain').textContent=truth;$('attackciphertext').textContent=text;$('truekey').textContent=key;$('estimated').textContent='—';$('statresult').textContent='Not run yet';$('statplaintext').textContent='Run the attack to find the most likely message.';$('scores').replaceChildren();$('candidatekeys').replaceChildren();attackClues();attackShow();}
function attackClues(){let letters=(attackText.match(/[A-Z]/g)||[]),counts=new Map(),words=(attackText.match(/[A-Z]+/g)||[]),wc=new Map();for(const c of letters)counts.set(c,(counts.get(c)||0)+1);for(const w of words)wc.set(w,(wc.get(w)||0)+1);let rep=[...wc].filter(x=>x[1]>1).map(x=>`${x[0]} × ${x[1]}`),dou=[...attackText.matchAll(/([A-Z])\1/g)].map(x=>x[0]),fre=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>`${x[0]}: ${x[1]}`);$('repeatedwords').textContent=rep.join(' · ')||'None';$('doubledletters').textContent=[...new Set(dou)].join(', ')||'None';$('topcipherletters').textContent=fre.join(' · ')||'None';}
function attackShow(){let k=attackCursor,candidate=caesar(attackText,-k),score=chi2(candidate);$('attacktrialkey').textContent=String(k);$('attacktrialtext').textContent=candidate;$('attacktrialscore').textContent=Number.isFinite(score)?score.toFixed(2):'N/A';$('attacktrialexplain').textContent=`Testing key ${k}: shift every letter backwards by ${k}. ${k===attackKey?'This matches the key used in our controlled example.':'This is another possible decryption.'} The statistical score is ${Number.isFinite(score)?score.toFixed(2):'unavailable'}; lower means more similar to the reference English distribution.`;}
function attackCandidates(){let root=$('candidatekeys');root.replaceChildren();for(let k=0;k<26;k++){let c=document.createElement('div');c.className='candidate-card'+(k===attackKey?' actual':'');let h=document.createElement('strong');h.textContent=`Key ${k}`;let t=document.createElement('div');t.className='mono';t.textContent=caesar(attackText,-k);c.append(h,t);root.append(c);}}
$('attackexample').addEventListener('click',()=>{const msg='TURING TURING',key=3;attackSet(caesar(msg,key),msg,key);});
$('attackcurrent').addEventListener('click',()=>{const m=$('message').value.toUpperCase(),key=Number($('shift').value);attackSet(caesar(m,key),m,key);});
$('attackprev').addEventListener('click',()=>{attackStop();attackCursor=(attackCursor+25)%26;attackShow();});
$('attacknext').addEventListener('click',()=>{attackStop();attackCursor=(attackCursor+1)%26;attackShow();});
$('attackplay').addEventListener('click',()=>{if(attackTimer!==null){attackStop();return;}$('attackplay').textContent='Ⅱ Pause';attackTimer=setInterval(()=>{attackCursor=(attackCursor+1)%26;attackShow();if(attackCursor===25)attackStop();},950);});
$('attackall').addEventListener('click',()=>{attackStop();attackCandidates();});
// Reader-facing explanations of live outputs (no invented experimental results).
function interpretOutput(){
  const m=$('message').value, shift=Number($('shift').value), plain=m.toUpperCase(), encrypted=caesar(m,shift);
  const letters=plain.match(/[A-Z]/g)||[];
  if($('caesaroutputnote'))$('caesaroutputnote').textContent=`You encrypted ${letters.length} letters with shift ${shift}. The output ${encrypted.slice(0,70)||'(empty)'} is obtained by replacing each letter with the letter ${shift} positions later. The decrypted output is identical to the original uppercased message: ${caesar(encrypted,-shift)===plain?'YES':'NO'}. The same letter always maps to the same ciphertext letter.`;
  const d=Number($('privatekey').value),r=Number($('ephemeral').value),Q=mul(d,G),R=mul(r,G),S=mul(r,Q),raw=new TextEncoder().encode(m);
  const ct=raw.map((x,i)=>x^maskByte(S,i));
  if($('eccoutputnote'))$('eccoutputnote').textContent=`With private scalar k=${d}, Q=${point(Q)}; Alice chooses r=${r}, sends R=${point(R)} and computes shared point S=${point(S)}. The ${raw.length} plaintext byte(s) become ${ct.length} ciphertext byte(s) through the toy XOR mask. Bob independently computes kR=${point(mul(d,R))}, matching Alice's S. This illustrates correctness, NOT security.`;
  const freq=new Map();for(const c of letters)freq.set(c,(freq.get(c)||0)+1);
  const repeated=[...freq.entries()].filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if($('propertiesoutputnote'))$('propertiesoutputnote').textContent=letters.length<20?`Only ${letters.length} letters: this is a very small sample, so visual frequency peaks are not reliable language estimates. Caesar still shifts counts without changing their multiset. Try a long English sentence to reveal its profile.`:`Your input contains ${letters.length} letters. Frequent repeated plaintext symbols: ${repeated.map(([c,n])=>c+' '+n+'×').join(', ')||'none'}. Caesar moves each symbol's entire count to another letter; hence its empirical alphabet entropy is unchanged. The ECC result depends on the toy mask, not on ECC mathematics alone.`;
}

function runStat(){const results=caesarAttack(attackText),best=results[0],byKey=[...results].sort((a,b)=>a.k-b.k),scores=$('scores');$('truekey').textContent=attackKey;$('estimated').textContent=best.k;$('statresult').textContent=best.k===attackKey?'Recovered correctly ✓':'Not recovered: sample may be too short';$('statplaintext').textContent=best.plain;if($('statoutputnote'))$('statoutputnote').textContent=`We tested all 26 shifts and ranked the possible plaintexts using English letter frequencies. The best score suggests key ${best.k}, with plaintext: ${best.plain.slice(0,140)}. ${best.k===shift?'For this sample, the estimated key matches the true key.':'This sample was too short or atypical for the statistical ranking to recover the true key.'} Exhaustive search itself guarantees the correct key is among the candidates, but it does not identify it automatically.`;attackCandidates();scores.replaceChildren();const finite=results.map(r=>r.score).filter(Number.isFinite),max=Math.max(...finite,1);for(const v of byKey){const col=document.createElement('div');col.className='barcol';col.title=`key ${v.k}, χ² ${v.score.toFixed(2)}`;const bar=document.createElement('div');bar.className='bar'+(v.k===best.k?' best':'');bar.style.height=`${Math.max(3,100*(1-Math.min(1,v.score/max)))}%`;const label=document.createElement('small');label.textContent=v.k;col.append(bar,label);scores.append(col);}}
const corpus=`The study of statistical methods allows us to describe patterns in observed data and compare them with mathematical models. A frequency distribution shows how often each observation occurs, while experiments help us measure uncertainty and test assumptions. In communication systems, information passes between people through networks, and an observer may see the transmitted data. Encryption transforms the original message into a different representation. In a simple substitution cipher, each letter is replaced by another letter, but the language structure may remain visible. The analysis of longer texts is often more reliable because a larger sample usually better represents the underlying distribution. Random selection, repeated trials, and careful measurement are important parts of scientific investigations. Cryptography studies algorithms designed to protect information, while cryptanalysis examines their limitations. A mathematical function may be easy to compute in one direction yet difficult to reverse without additional information. Nevertheless a weak choice of parameters can compromise an otherwise interesting mathematical construction. Researchers compare experimental results, examine error rates and explain why a proposed attack succeeds or fails under different conditions. The purpose of the experiment is not only to demonstrate the algorithm but also to understand the assumptions that make it useful. The secret message is delivered to the receiver after it has been transformed by the encryption process. A receiver holding the correct secret can reconstruct the original data, while an attacker without the key tries to find patterns and exploit weaknesses.`.toUpperCase().replace(/[^A-Z]/g,'');
function seeded(seed){return ()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function batch(){const rng=seeded(20261016),lengths=[10,25,50,100,250,500,1000],container=$('batchresults');container.replaceChildren();for(const n of lengths){let correct=0;for(let t=0;t<120;t++){const start=Math.floor(rng()*(corpus.length-n+1)),text=corpus.slice(start,start+n),k=Math.floor(rng()*26);if(caesarAttack(caesar(text,k))[0].k===k)correct++;}const row=document.createElement('div');row.className='batchrow';const label=document.createElement('span');label.textContent=`${n} chars`;const track=document.createElement('div');track.className='batchtrack';const fill=document.createElement('div');fill.className='batchfill';fill.style.width=`${correct/120*100}%`;track.append(fill);const val=document.createElement('span');val.textContent=`${(correct/120*100).toFixed(1)}%`;row.append(label,track,val);container.append(row);}}
let eccAttackCandidate=0,eccAttackDone=false;
function resetEccAttack(){eccAttackCandidate=0;eccAttackDone=false;$('attacktrace').replaceChildren();$('attacktrace').textContent='No candidates tested yet.';$('recoveredkey').textContent='—';$('attempts').textContent='0';$('eccattackexplanation').textContent='Begin with d = 1 and compare dG to Q.';updateAttackedPoint();}
function updateAttackedPoint(){const Q=mul(Number($('privatekey').value),G);$('attackedpoint').textContent=point(Q);}
function eccAttackStep(){if(eccAttackDone||eccAttackCandidate>=8)return;const Q=mul(Number($('privatekey').value),G);const d=++eccAttackCandidate;const candidate=mul(d,G);const hit=equal(candidate,Q);const out=$('attacktrace');if(d===1)out.replaceChildren();const line=document.createElement('div');line.className=hit?'hit':'';line.textContent=`d = ${d} → dG = ${point(candidate)} ${hit?'✓ MATCH':'≠ Q'}`;out.append(line);$('attempts').textContent=String(d);$('eccattackexplanation').textContent=hit?`At d = ${d}, the computed point equals Bob's public key Q. Eve has found the toy private scalar after ${d} candidate${d===1?'':'s'}.`:`d = ${d} produces ${point(candidate)}, which differs from Q = ${point(Q)}. Eve rejects this candidate and continues.`;if(hit){eccAttackDone=true;$('recoveredkey').textContent=String(d);} }
function runEcc(){while(!eccAttackDone&&eccAttackCandidate<8)eccAttackStep();}
$('eccattemptnext').addEventListener('click',eccAttackStep);
$('eccattemptreset').addEventListener('click',resetEccAttack);
const keySpaceExplanations={3:['8 candidates','4 trials','A few trials: practical by hand.'],16:['65,536 candidates','32,768 trials','Still a small range for computers.'],32:['2³² candidates','≈ 2³¹ trials','Large for manual search, but not enough for cryptographic security.'],128:['2¹²⁸ candidates','≈ 2¹²⁷ trials','Beyond ordinary brute-force resources.'],256:['≈ 2²⁵⁶ candidates','≈ 2²⁵⁵ trials','Exhaustive enumeration is infeasible. Generic elliptic-curve attacks are faster but still astronomically costly.']};
function renderKeySize(){const bits=Number($('keysizeexample').value),record=keySpaceExplanations[bits];$('keyspacevalue').textContent=record[0];$('expectedtrials').textContent=record[1];$('searchcomplexity').textContent=bits<=16?'Small':bits===32?'Moderate (computationally)': 'Infeasible';$('keysizeinterpretation').textContent=record[2]+' Longer Caesar messages help distinguish shifts statistically, but ECC public-key search does not use the language of the message.';}
$('keysizeexample').addEventListener('change',renderKeySize);renderKeySize();
for(const id of ['privatekey','ephemeral']){for(let k=1;k<=8;k++){const opt=document.createElement('option');opt.value=k;opt.textContent=k;$(id).append(opt);}}$('privatekey').value='6';$('ephemeral').value='4';for(const id of ['message','shift','privatekey','ephemeral'])$(id).addEventListener('input',()=>{update();$('statresult').textContent='Not run yet';$('estimated').textContent='–';$('scores').replaceChildren();$('recoveredkey').textContent='–';$('attempts').textContent='–';resetEccAttack();});$('runstat').addEventListener('click',runStat);$('runbatch').addEventListener('click',batch);$('runecc').addEventListener('click',runEcc);update();

attackSet(caesar("TURING TURING",3),"TURING TURING",3);resetEccAttack();

for(const id of ['eccattemptnext','runecc','eccattemptreset']){const button=$(id);if(button)button.addEventListener('click',()=>{const output=$('eccattackoutputnote');if(!output)return;const attempts=$('attempts').textContent;const recovered=$('recoveredkey').textContent;output.textContent=recovered!=='—'&&recovered!=='–'?`After ${attempts} candidate test(s), a matching scalar ${recovered} was found: dG equals the public point Q. No ciphertext frequency analysis was needed; the attack worked because the key space was tiny.`:`We have tested ${attempts} candidate(s). Every failed comparison rules out one scalar; continue until dG equals Q.`;});}
if($('keysizeexample'))$('keysizeexample').addEventListener('change',()=>{const b=Number($('keysizeexample').value);$('securityoutputnote').textContent=`A ${b}-bit hypothetical key has about 2^${b} candidates. Sequential brute force grows exponentially with b; properly configured secp256k1 also admits generic discrete-log attacks requiring about 2^128 group operations, still impractical. This does not repair weaknesses in the toy XOR mask.`;});
