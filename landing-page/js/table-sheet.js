(function(){
/* "View full table": full-screen sheet with the real table. Zoom = transform scale (GPU), pinch or +/- buttons, native scrolling. */
var BW=580;
function mk(wrapSel,title,where,kind){var w=document.querySelector(wrapSel);if(!w)return;var tb=w.querySelector('table');if(!tb)return;
var btn=document.createElement('button');btn.type='button';btn.className='cmp-open';btn.innerHTML='View full table <span>&#x2922;</span>';
if(where==='before')w.insertBefore(btn,w.firstChild);else w.parentNode.appendChild(btn);
var sh=document.createElement('div');sh.className='cmp-sheet';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label',title);
sh.innerHTML='<div class="cmp-bar"><b>'+title+'</b><span class="cmp-ctl"><button type="button" data-z="-1" aria-label="Zoom out"></button><button type="button" data-z="1" aria-label="Zoom in"></button><button type="button" class="cmp-x" aria-label="Close"></button></span></div><div class="cmp-scroll"></div><p class="cmp-hint">Pinch or use + / &minus; to zoom. Drag to move around.</p>';
document.body.appendChild(sh);
var sc=sh.querySelector('.cmp-scroll'),zw=null,t=null,s=1,min=.6,max=2.6,bh=0,raf=0;
function clamp(v){return Math.max(min,Math.min(max,v))}
function apply(ns,cx,cy){ns=clamp(ns);if(Math.abs(ns-s)<.001)return;var r=ns/s,px=sc.scrollLeft+cx,py=sc.scrollTop+cy;s=ns;
 t.style.transform='scale('+s+')';zw.style.width=BW*s+'px';zw.style.height=bh*s+'px';sc.scrollLeft=px*r-cx;sc.scrollTop=py*r-cy}
function open(){
 if(!t){t=tb.cloneNode(true);t.classList.add('cs-table','cs-'+kind);[].slice.call(t.querySelectorAll('tbody tr')).forEach(function(r){if(!r.textContent.replace(/\s+/g,''))r.remove()});zw=document.createElement('div');zw.className='cs-zw';zw.appendChild(t);sc.appendChild(zw);bindPinch()}
 sh.hidden=false;document.body.classList.add('cmp-open-b');
 t.style.width=BW+'px';bh=t.offsetHeight;min=Math.min(1,(sc.clientWidth-24)/BW);s=0;apply(min,0,0);sc.scrollTop=0;sc.scrollLeft=0}
function close(){sh.hidden=true;document.body.classList.remove('cmp-open-b')}
function bindPinch(){var d0=0,s0=1,pend=null;
 function dist(e){var a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}
 sc.addEventListener('touchstart',function(e){if(e.touches.length===2){d0=dist(e);s0=s}},{passive:true});
 sc.addEventListener('touchmove',function(e){if(e.touches.length!==2||!d0)return;e.preventDefault();
  var r=sc.getBoundingClientRect(),a=e.touches[0],b=e.touches[1];pend=[s0*dist(e)/d0,(a.clientX+b.clientX)/2-r.left,(a.clientY+b.clientY)/2-r.top];
  if(!raf)raf=requestAnimationFrame(function(){raf=0;if(pend)apply(pend[0],pend[1],pend[2])})},{passive:false});
 sc.addEventListener('touchend',function(e){if(e.touches.length<2)d0=0},{passive:true})}
btn.addEventListener('click',open);
var sm=kind==='plan'&&w.parentNode.querySelector('summary');if(sm)sm.addEventListener('click',function(e){if(matchMedia('(max-width:760px)').matches){e.preventDefault();open()}});
sh.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.classList.contains('cmp-x'))close();else if(b.dataset.z){apply(s*(b.dataset.z>0?1.35:1/1.35),sc.clientWidth/2,sc.clientHeight/2)}});
addEventListener('keydown',function(e){if(e.key==='Escape'&&!sh.hidden)close()})}
mk('#compare .compare-table-wrap','How it stacks up','after','cmp');
mk('#pricing .plan-compare-wrap','Compare every feature','before','plan');
})();
