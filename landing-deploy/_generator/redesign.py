# v12 warm light redesign: transforms index.v11.html -> index.html
import re
s=open('/root/lp/index.v11.html').read()

HEART='M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z'
def clover(cls='',gid='c'):
    g=''
    for rot,f in ((0,'A'),(90,'B'),(180,'A'),(270,'B')):
        g+=f'<g transform="translate(100 100) rotate({rot}) translate(0 -13) scale(.8) translate(-50 -88)"><path d="{HEART}" fill="url(#{gid}{f})"/></g>'
    return (f'<svg class="{cls}" viewBox="18 18 164 164" aria-hidden="true"><defs>'
            f'<linearGradient id="{gid}A" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d28b"/><stop offset="1" stop-color="#e0956a"/></linearGradient>'
            f'<linearGradient id="{gid}B" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5718a"/><stop offset="1" stop-color="#b03a60"/></linearGradient></defs>{g}</svg>')


HP="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z"
def _hearts(kind):
    o=''
    for rot,f in ((0,'hcA'),(90,'hcB'),(180,'hcA'),(270,'hcB')):
        t=f'translate(100 100) rotate({rot}) translate(0 -13) scale(.8) translate(-50 -88)'
        if kind=='shadow': o+=f'<path d="{HP}" transform="{t}" fill="#3b2218"/>'
        else:
            o+=(f'<g transform="{t}"><path d="{HP}" fill="url(#{f})" stroke="#3b2218" stroke-width="3.2" stroke-linejoin="round"/>'
                f'<path d="M15 33 C13 24 20 17 29 16" fill="none" stroke="#fff6e9" stroke-opacity=".7" stroke-width="4.2" stroke-linecap="round"/>'
                f'<circle cx="38" cy="19" r="2.2" fill="#fff6e9" fill-opacity=".8"/></g>')
    return o
def _orbit():
    import math
    o='<g class="orbit"><circle cx="290" cy="280" r="236" fill="none" stroke="#3b2218" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="2 11" stroke-linecap="round"/>'
    items=[(-60,'h','#e5718a'),(15,'s','#3b2218'),(95,'h','#f2c777'),(170,'s','#e5718a'),(235,'h','#3b2218'),(300,'s','#f2c777')]
    for ang,k,col in items:
        x=290+236*math.cos(math.radians(ang)); y=280+236*math.sin(math.radians(ang))
        if k=='h': o+=f'<g transform="translate({x:.1f} {y:.1f})"><circle r="20" fill="#fffdf8" stroke="#3b2218" stroke-width="3"/><path d="M0 8 C-12 0 -10 -11 -4 -11 C-1 -11 0 -9 0 -7 C0 -9 1 -11 4 -11 C10 -11 12 0 0 8 Z" fill="{col}"/></g>'
        else: o+=f'<path d="M0-13C1.5-4 4-1.5 13 0 4 1.5 1.5 4 0 13-1.5 4-4 1.5-13 0-4-1.5-1.5-4 0-13Z" transform="translate({x:.1f} {y:.1f})" fill="{col}"/>'
    return o+'</g>'
HERO_ART=('<svg class="art" viewBox="0 0 560 560"><defs>'
 '<radialGradient id="hcb" cx=".35" cy=".28" r=".9"><stop offset="0" stop-color="#fff0cc"/><stop offset=".5" stop-color="#f9d596"/><stop offset="1" stop-color="#f0a97a"/></radialGradient>'
 '<linearGradient id="hcA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe0a0"/><stop offset="1" stop-color="#e0956a"/></linearGradient>'
 '<linearGradient id="hcB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef8aa0"/><stop offset="1" stop-color="#b03a60"/></linearGradient></defs>'
 '<circle cx="300" cy="290" r="196" fill="#3b2218"/><circle cx="290" cy="280" r="196" fill="url(#hcb)" stroke="#3b2218" stroke-width="4"/>'
 '<circle cx="290" cy="280" r="168" fill="none" stroke="#fff6e9" stroke-opacity=".55" stroke-width="2"/><circle cx="290" cy="280" r="132" fill="none" stroke="#fff6e9" stroke-opacity=".4" stroke-width="2"/>'
 +_orbit()+
 '<g class="cl"><g transform="translate(299 289) scale(2.15) translate(-100 -100)">'+_hearts('shadow')+'</g>'
 '<g transform="translate(290 280) scale(2.15) translate(-100 -100)">'+_hearts('main')+'</g></g>'
 '<g class="spk1">'+'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate(432 138) scale(1.9)" fill="#fffdf8" stroke="#3b2218" stroke-width="2"/></g>'
 '<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate(150 410) scale(1.1)" fill="#3b2218"/>'
 '</svg>\n')

# ---- head
s=re.sub(r'<link href="https://fonts.googleapis.com/css2\?[^"]*" rel="stylesheet" />',
 '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />',s)
s=s.replace('css/home.css?v=11','css/home.css?v=24')
s=s.replace('<meta name="theme-color" content="#130b0f" />','<meta name="theme-color" content="#fff4e1" />')

# ---- hero + ribbon
a=s.index('<section class="hx-hero">'); b=s.index('</section>',a)+len('</section>')
hero_old=s[a:b]
form=re.search(r'<form class="hx-form" id="hero-form".*?<p class="hx-note">.*?</p>',hero_old,flags=re.S).group(0)
stamp=('<svg class="stamp" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="stp" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>'
       '<circle cx="60" cy="60" r="58" fill="#3b2218"/><text font-family="Inter,Arial,sans-serif" font-size="10.5" font-weight="700" fill="#f6d28b"><textPath href="#stp" textLength="268" lengthAdjust="spacing">FREE TO START · NO CARD · NO SPAM ·</textPath></text>'
       '<g transform="translate(60 60) scale(.2) translate(-100 -100)">'
       +''.join(f'<g transform="translate(100 100) rotate({r}) translate(0 -13) scale(.8) translate(-50 -88)"><path d="{HEART}" fill="{c}"/></g>' for r,c in ((0,'#f6d28b'),(90,'#e5718a'),(180,'#f6d28b'),(270,'#e5718a')))
       +'</g></svg>')
hero=f'''<section class="hx-hero">
      <div class="hx-wrap hero-grid">
        <div class="hx-copy">
          <span class="hx-kicker big"><i></i>AI relationship coach</span>
          <h1><span class="hx-l1">Know what to say</span><span class="hx-rot" aria-live="off"><em class="on">before you send.</em><em>after a fight.</em><em>when it&rsquo;s hard.</em><em>at 2am.</em></span></h1>
          <p class="hx-sub">Your private coach for the hard talks. There at 2am.</p>
          {form}
        </div>
        <div class="hero-art" aria-hidden="true">
          <i class="blob b1"></i>
          {clover('clover','h')}
          <svg class="ring" viewBox="0 0 560 560" aria-hidden="true"><defs><path id="rp" d="M77 274 a214 214 0 1 1 428 0 a214 214 0 1 1 -428 0"/></defs><text font-family="Inter,Arial,sans-serif" font-size="32" font-weight="700" fill="#3b2218"><textPath href="#rp" textLength="1330" lengthAdjust="spacing">SAY IT CALMLY <tspan fill="#b03a60">&#9829;</tspan> SAY IT CLEARLY <tspan fill="#b03a60">&#9829;</tspan> SAY IT WITH LOVE <tspan fill="#b03a60">&#9829;</tspan> </textPath></text></svg>
          {stamp}
        </div>
      </div>
    </section>
    <div class="ribbon" aria-hidden="true"><div class="rib-track">{''.join('<span>Before the talk</span><i></i><span>Before you send</span><i></i><span>When it hurts</span><i></i><span>At 2am</span><i></i>' for _ in range(4))}</div></div>'''
s=s[:a]+hero+s[b:]

# ---- tools
a=s.index('<section class="hx-sec hx-tools" id="tools">'); b=s.index('</section>',a)+len('</section>')
tools='''<section class="hx-sec hx-tools" id="tools">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal"><span class="hx-kicker">Three tools</span><h2>Pick the moment. <em>We&rsquo;ll help with the words.</em></h2></div>
      </div>
    </section>'''
tools_end='''<section class="hx-sec hx-tools-end">
      <div class="hx-wrap">
        <div class="hx-center-cta hx-reveal"><a href="#join" class="hx-btn" data-umami-event="cta-tools">Get early access</a> <span class="hx-free">Free to try</span></div>
        <div class="hx-frame hx-center-frame"><b>Inspired by</b><span>The Gottman Method</span><i></i><span>Attachment theory</span><i></i><span>Nonviolent Communication</span></div>
      </div>
    </section>'''
s=s[:a]+tools+s[b:]
import re as _re
s=_re.sub(r'<ul class="chap-facts">.*?</ul>\s*','',s,flags=_re.S)
s=s.replace('<p>An AI plays your partner, so you can find the words with nothing at stake. Then get a short debrief.</p>','<p>An AI plays your partner. Rehearse with nothing at stake.</p>')
s=s.replace('<p>Check a message before you send it. See how it may land and get calmer, warmer or more direct versions.</p>','<p>See how it lands. Get a calmer version.</p>')
s=s.replace('<p>Tell it what happened. It remembers your partner and your past chats, so you never start from zero. There at 2am.</p>','<p>It remembers your story, so you never start from zero.</p>')
s=s.replace('<div class="bub u">When plans change last minute, I feel unimportant.</div>\n            <div class="bub a">I didn&rsquo;t know it hurt you. Tell me more.</div>','<div class="bub u">When plans change, I feel unimportant.</div>')
i=s.index('id="coach"'); j=s.index('</section>',i)+len('</section>')
s=s[:j]+'\n    '+tools_end+s[j:]

# ---- flagship accordion
a=s.index('<section class="hx-sec hx-tools" id="tools">')
i=s.index('id="practice"'); pm=s[s.index('<div class="mock">',i):]; pm=pm[:pm.index('</div>\n          </div>\n        </div>\n      </div>\n    </section>')]+'</div>'
i=s.index('id="coach"'); cm=s[s.index('<div class="mock">',i):]; cm=cm[:cm.index('</div>\n          </div>\n        </div>\n      </div>\n    </section>')]+'</div>'
i=s.index('id="message"'); dm=s[s.index('<div class="hx-demo hx-reveal" id="demo-box">',i):]; dm=dm[:dm.index('</section>')].rstrip(); assert dm.endswith('</div>'); dm=dm[:-6].rstrip().replace('hx-demo hx-reveal','hx-demo')
b=s.index('</section>',s.index('id="coach"'))+len('</section>')
pm="""<div class="mock">
              <div class="mock-top"><i></i>Practice with Alex <em>Example</em></div>
              <div class="bub u">There&rsquo;s something I want to tell you.</div>
              <div class="bub a">Okay. I&rsquo;m listening.</div>
              <div class="bub u">When plans change, I feel unimportant.</div>
              <div class="mock-deb"><small>Debrief</small><p>Calm start, clear feeling. <b>Next time:</b> say what you need.</p></div>
              <div class="mock-input"><span>Say it your way&hellip;</span><b>&uarr;</b></div>
            </div>"""
cm="""<div class="mock">
              <div class="mock-top"><i></i>Coach Chat <em>Example</em></div>
              <div class="bub u">We had the same fight again.</div>
              <div class="mock-mem"><i></i>Remembers: the Tuesday dishes fight</div>
              <div class="bub a">Let&rsquo;s look underneath it this time.</div>
              <div class="mock-deb"><small>Try saying</small><p>&ldquo;I feel unseen when I carry the house alone. Can we split it differently?&rdquo;</p></div>
              <div class="mock-input"><span>Tell it what happened&hellip;</span><b>&uarr;</b></div>
            </div>"""
dm="""<div class="hx-demo" id="demo-box">
              <div class="mock-top"><i></i>Message check <em>Example</em></div>
              <div class="dm-pick" role="tablist" aria-label="Choose a situation">
                <button type="button" class="on" data-i="0">They forgot something</button>
                <button type="button" data-i="1">They went quiet</button>
                <button type="button" data-i="2">Chores fight</button>
              </div>
              <div class="dm-card dm-before"><small>You wrote</small><p id="dm-draft"></p><span class="hx-risk" id="dm-risk"></span></div>
              <div class="dm-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
              <div class="dm-card dm-after"><small>Try this instead</small><p id="dm-fix"></p><span class="dm-why" id="dm-why"></span></div>
              <div class="dm-tone" hidden><button type="button" class="on" data-t="calm">Calmer</button></div>
            </div>"""
def page(n,cls,idn,when,h,p,vis,nxt,name=''):
    return f"""<article class="page {cls}" id="{idn}" data-i="{int(n)-1}">
          <div class="pg-in">
            <button type="button" class="pg-head"><span class="fnum">{n}</span><span class="ftxt"><small><b>{name}</b><span>{when}</span></small><h3>{h}</h3></span><span class="pg-turn" aria-hidden="true">Next</span></button>
            <div class="flag-body"><p>{p}</p><div class="flag-vis">{vis}</div></div>
            <div class="pg-foot"><button type="button" class="pg-next">{nxt}</button></div>
          </div>
        </article>"""
acc=f"""<section class="hx-sec hx-tools" id="tools">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal"><span class="hx-kicker">Three tools</span><h2>Pick the moment. <em>We&rsquo;ll help with the words.</em></h2></div>
        <div class="deck hx-reveal" id="deck">
          <div class="deck-stage">
        {page('01','f1','practice','Before the talk','Say it out loud <em>before it&rsquo;s real</em>.','An AI plays your partner. Rehearse with nothing at stake.',pm,'Next','Partner Practice')}
        {page('02','f2','message','Before you send','Read it the way <em>they will</em>.','See how it lands. Get a calmer version.',dm,'Next','Message check')}
        {page('03','f3','coach','When it hurts','A coach that <em>already knows</em> your story.','It remembers your story, so you never start from zero.',cm,'Next','Coach Chat')}
          </div>
          <div class="deck-dots" role="tablist" aria-label="Choose a tool"><button type="button" data-go="0" class="on" role="tab"><i></i>Before the talk</button><button type="button" data-go="1" role="tab"><i></i>Before you send</button><button type="button" data-go="2" role="tab"><i></i>When it hurts</button></div>
        </div>
      </div>
    </section>
    <script>(function(){{var deck=document.getElementById('deck');if(!deck)return;var st=deck.querySelector('.deck-stage'),P=[].slice.call(deck.querySelectorAll('.page')),D=[].slice.call(deck.querySelectorAll('.deck-dots button')),N=['Partner Practice','Message check','Coach Chat'],a=0,dir=1,ro;
function nat(p){{var c=p.querySelector('.pg-in').children,t=0;for(var k=0;k<c.length;k++)t+=c[k].offsetHeight;return t+26}}
function lay(){{var h=0;P.forEach(function(p){{h=Math.max(h,nat(p))}});st.style.height=h+'px';var nx=dir>0&&a<P.length-1?a+1:(dir<0&&a>0?a-1:(a>0?a-1:a+1)),fw=nx>a;P.forEach(function(p,i){{p.dataset.s=i<a?'turned':i==a?'front':i==a+1?'b1':'b2';p.style.height=h+'px';if(i==a){{p.removeAttribute('inert');p.removeAttribute('aria-hidden');p.querySelector('.pg-next').innerHTML=(fw?'Next: ':'Back: ')+N[nx]+(fw?' &rarr;':' &larr;');p.querySelector('.pg-turn').textContent=fw?'Next':'Back'}}else{{p.setAttribute('inert','');p.setAttribute('aria-hidden','true')}}}});D.forEach(function(d,i){{d.classList.toggle('on',i==a);d.setAttribute('aria-selected',i==a)}})}}
function go(n){{a=n;lay();if(window.ResizeObserver&&!ro){{ro=new ResizeObserver(lay);P.forEach(function(p){{[].slice.call(p.querySelector('.pg-in').children).forEach(function(c){{ro.observe(c)}})}})}}}}
function step(){{if(a==P.length-1)dir=-1;else if(a==0)dir=1;go(a+dir)}}
deck.classList.add('js');
P.forEach(function(p){{p.addEventListener('click',function(e){{if(!p.dataset.s||p.dataset.s!=='front')return;if(e.target.closest('.hx-demo, a, input, select, textarea')&&!e.target.closest('.pg-next'))return;step()}})}});
D.forEach(function(d){{d.addEventListener('click',function(){{var n=+d.dataset.go;if(n>a)dir=1;else if(n<a)dir=-1;go(n)}})}});
function hash(){{var m=location.hash&&document.querySelector('.page'+location.hash);if(m)go(+m.dataset.i)}}
addEventListener('hashchange',hash);addEventListener('resize',lay);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(lay);go(0);hash();}})();</script>"""
s=s[:a]+acc+s[b:]

# ---- final CTA: add clover decoration
s=s.replace('<div class="hx-final hx-reveal">','<div class="hx-final hx-reveal">'+clover('fclover','f'))
# footer clover
open('/root/lp/index.html','w').write(s)
print('ok',len(s))
