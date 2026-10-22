# v12 warm light redesign: transforms index.v11.html -> index.html
import re
s=open('/root/lp/index.v11.html').read()

HEART='M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z'
def clover(cls='',gid='c'):
    g=''
    for rot,f in ((0,'A'),(90,'B'),(180,'A'),(270,'B')):
        g+=f'<g transform="translate(100 100) rotate({rot}) translate(0 -13) scale(.8) translate(-50 -88)"><path d="{HEART}" fill="url(#{gid}{f})"/></g>'
    return (f'<svg class="{cls}" viewBox="18 18 164 164" aria-hidden="true"><defs>'
            f'<linearGradient id="{gid}A" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe6b0"/><stop offset="1" stop-color="#f3c97a"/></linearGradient>'
            f'<linearGradient id="{gid}B" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fac0cf"/><stop offset="1" stop-color="#ee8ea8"/></linearGradient></defs>{g}</svg>')


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
 '<linearGradient id="hcA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe6b0"/><stop offset="1" stop-color="#f3c97a"/></linearGradient>'
 '<linearGradient id="hcB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fac0cf"/><stop offset="1" stop-color="#ee8ea8"/></linearGradient></defs>'
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
 '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />',s)
s=s.replace('<img src="logo-mark.svg" alt="" width="34" height="34" />','<img src="logo-tile.svg" alt="" width="38" height="38" />')
import re as _re
s=_re.sub(r'<!--LANG-SWITCH-->.*?<!--/LANG-SWITCH-->','<!--LANG-SWITCH--><!--/LANG-SWITCH-->',s,flags=_re.S)
s=_re.sub(r'<!--LANG-ALTS-->.*?<!--/LANG-ALTS-->','<!--LANG-ALTS--><!--/LANG-ALTS-->',s,flags=_re.S)
s=s.replace('css/home.css?v=11','css/home.css?v=81')
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
def _chips(words, off=0):
    cols=['c0','c1','c2','c3']
    return '<div class="chip-set">'+''.join(f'<span class="chip-pill {cols[(k+off)%4]}">{w}</span>' for k,w in enumerate(words))+'</div>'
CH1=_chips(['Before the talk','Before you send','When it hurts','At 2am','After a fight','Say it calmly'])
CH2=_chips(['Practice it first','Find the words','Not another spiral','Calm, clear, kind','You are not alone at 2am','Try it free'],2)
TK='<div class="tick-set">'+''.join(f'<span>{w}</span><i></i>' for w in ['Before the talk','Before you send','When it hurts','At 2am','After a fight','When words fail'])+'</div>'
def _hero4():
    cfg=[(0,'#f7d99a','0','-9px'),(90,'#f2a0b4','9px','0'),(180,'#f8c7a3','0','9px'),(270,'#f2a0b4','-9px','0')]
    gap=7
    sh='';fg=''
    for n,(rot,col,dx,dy) in enumerate(cfg):
        t=f'rotate({rot}) translate(0 -{13+gap}) scale(.8) translate(-50 -88)'
        sh+=f'<g class="hb" style="--dx:{dx};--dy:{dy};animation-delay:-{n*0.9}s"><g transform="translate(280 280) scale(2.9)"><g transform="translate(2.7 2.7)"><path d="{HEART}" transform="{t}" fill="#3b2218"/></g></g></g>'
        fg+=f'<g class="hb" style="--dx:{dx};--dy:{dy};animation-delay:-{n*0.9}s"><g transform="translate(280 280) scale(2.9)"><path d="{HEART}" transform="{t}" fill="{col}" stroke="#3b2218" stroke-width="1.7" stroke-linejoin="round"/></g></g>'
    star=lambda x,y,sc,c: f'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate({x} {y}) scale({sc})" fill="{c}" stroke="#3b2218" stroke-width="1.6"/>'
    deco=star(86,92,1.5,'#fff3e2')+star(488,128,1.1,'#f7d99a')+star(112,470,.9,'#f4b8c4')
    return f'<svg class="hero4" viewBox="0 0 560 560" aria-hidden="true">{sh}{fg}<g class="spk">{deco}</g></svg>'
HERO4=_hero4()
def _hero5():
    def heart(x,y,sc,col,inner='',rot=0,delay=0,dy='-8px'):
        sw=4/sc; off=7/sc
        t=f'translate({x} {y}) rotate({rot} 50 44) scale({sc})'
        return (f'<g class="hb" style="--dx:0;--dy:{dy};animation-delay:-{delay}s"><g transform="{t}">'
                f'<path d="{HEART}" transform="translate({off:.2f} {off:.2f})" fill="#3b2218"/>'
                f'<path d="{HEART}" fill="{col}" stroke="#3b2218" stroke-width="{sw:.2f}" stroke-linejoin="round"/>{inner}</g></g>')
    dots=''.join(f'<circle class="td td{i}" cx="{cx}" cy="38" r="6.2" fill="#3b2218"/>' for i,cx in enumerate((35,50,65)))
    bars_p='<rect x="28" y="30" width="44" height="7" rx="3.5" fill="#fff3e2" stroke="#3b2218" stroke-width="1.6"/><rect x="28" y="44" width="30" height="7" rx="3.5" fill="#fff3e2" stroke="#3b2218" stroke-width="1.6"/>'
    bars_o='<rect x="30" y="28" width="40" height="8" rx="4" fill="#fff3e2" stroke="#3b2218" stroke-width="2"/><rect x="30" y="43" width="26" height="8" rx="4" fill="#fff3e2" stroke="#3b2218" stroke-width="2"/>'
    star=lambda x,y,sc,c: f'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate({x} {y}) scale({sc})" fill="{c}" stroke="#3b2218" stroke-width="1.6"/>'
    deco=star(70,110,1.3,'#fff3e2')+star(500,250,1.0,'#f7d99a')+star(300,520,.9,'#fff3e2')
    body=(heart(392,26,1.55,'#f8c7a3',bars_o,rot=8,delay=1.5,dy='-10px')
          +heart(112,84,3.5,'#f7d99a',dots,delay=0,dy='-8px')
          +heart(26,330,2.0,'#f2a0b4',bars_p,rot=-9,delay=3,dy='9px'))
    return f'<svg class="hero4" viewBox="0 0 560 560" aria-hidden="true">{body}<g class="spk">{deco}</g></svg>'
HERO4=_hero5()
HERO4='''<div class="hph" id="hph" role="group" aria-label="Product preview">
            <div class="hph-frame"><i class="hph-notch"></i>
              <div class="hph-scr">
                <div class="hs on">
                  <div class="hs-top"><i></i>Partner Practice</div>
                  <div class="hs-lbl">Rehearse the hard talk first</div>
                  <div class="bb me">You always cancel on me.</div>
                  <div class="bb ai">Here we go again. I was just tired.</div>
                  <div class="hs-card bt"><small>Coach note</small>Starting with blame made them defensive. <b>Try:</b> &ldquo;I felt hurt when plans fell through.&rdquo;</div>
                  <div class="hs-inp"><span>Say it your way&hellip;</span><b>&uarr;</b></div>
                </div>
                <div class="hs">
                  <div class="hs-top"><i></i>Message check</div>
                  <div class="hs-lbl">Your draft</div>
                  <div class="hs-card pk">Fine. Do whatever you want.<span>Reads as cold &middot; likely to start a fight</span></div>
                  <div class="hs-arrow">&darr;</div>
                  <div class="hs-lbl">Says what you actually mean</div>
                  <div class="hs-card bt">I&rsquo;m upset you didn&rsquo;t tell me. Can we talk tonight?<span>Honest, calm, invites a reply</span></div>
                  <div class="hs-chips"><b>Calmer</b><i>Warmer</i><i>Direct</i></div>
                </div>
                <div class="hs">
                  <div class="hs-top"><i></i>Coach Chat</div>
                  <div class="hs-lbl">2:07 AM &middot; can&rsquo;t sleep</div>
                  <div class="bb me">He went quiet again.</div>
                  <div class="hs-mem"><i></i>Remembers: he withdraws when stressed</div>
                  <div class="bb ai">That&rsquo;s his stress pattern, not rejection.</div>
                  <div class="hs-card bt"><small>Tomorrow, try</small>&ldquo;I miss you. Can we talk after dinner?&rdquo;</div>
                  <div class="hs-inp"><span>Tell it what happened&hellip;</span><b>&uarr;</b></div>
                </div>
                <div class="hph-tabs"><button type="button" class="on" data-i="0" aria-label="Partner Practice">Practice</button><button type="button" data-i="1" aria-label="Message check">Check</button><button type="button" data-i="2" aria-label="Coach Chat">Coach</button></div>
              </div>
            </div>
          </div>
          <script>(function(){var r=document.getElementById('hph');if(!r)return;var S=[].slice.call(r.querySelectorAll('.hs')),T=[].slice.call(r.querySelectorAll('.hph-tabs button')),i=0,t,mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;function go(n){i=n;S.forEach(function(e,k){e.classList.toggle('on',k===n)});T.forEach(function(e,k){e.classList.toggle('on',k===n);e.classList.remove('run');});void r.offsetWidth;if(!mq)T[n].classList.add('run');clearTimeout(t);if(!mq)t=setTimeout(function(){go((i+1)%S.length)},5200)}T.forEach(function(b,k){b.addEventListener('click',function(){go(k)})});r.addEventListener('mouseenter',function(){clearTimeout(t);T[i].classList.remove('run')});r.addEventListener('mouseleave',function(){go(i)});go(0)})();</script>'''
HEROBG='<div class="hero-bg" aria-hidden="true">'+clover('hcl hcl-a','ha')+clover('hcl hcl-b','hb2')+clover('hcl hcl-c','hc3')+'</div>'
PGBG='<div class="page-bg" aria-hidden="true">'+''.join(f'<span class="pbg" style="top:{t}px;{sd}:{o}%;--s:{sc};--r:{r}deg;--o:{op}">'+clover('','pg')+'</span>' for t,sd,sc,r,o,op in [(762, 'left', 30, 20, -9, 0.5), (1637, 'right', 24, 10, -9, 0.58), (2329, 'right', 24, 20, -4, 0.5), (3201, 'right', 24, 32, -4, 0.5), (4104, 'left', 24, -12, -9, 0.58), (4792, 'left', 30, -24, -6, 0.5), (5707, 'left', 30, 32, -9, 0.5), (6563, 'right', 26, -12, -9, 0.58), (7335, 'right', 24, 32, -9, 0.5), (8218, 'right', 30, 20, -4, 0.5), (8999, 'left', 34, 20, -12, 0.5), (9763, 'left', 30, -34, -6, 0.5), (10667, 'left', 36, 32, -4, 0.5), (11454, 'right', 36, 32, -9, 0.5), (12291, 'right', 28, -12, -12, 0.58), (13105, 'right', 28, -24, -9, 0.5), (13887, 'left', 26, 10, -4, 0.58), (14637, 'left', 24, 10, -4, 0.5)])+'</div>'
hero=f'''<section class="hx-hero">
      {HEROBG}
      <div class="hx-wrap hero-grid">
        <div class="hx-copy">
          <h1><span class="hx-l1">Know what to say</span><span class="hx-rot" aria-live="off"><em class="on">before you send.</em><em>after a fight.</em><em>when it&rsquo;s hard.</em><em>at 2am.</em></span></h1>
          <p class="hx-sub">Your private coach for the hard talks. There at 2am.</p>
          {form}
        </div>
        <div class="hero-art">
          {HERO4}
        </div>
      </div>
    </section>'''
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
            <div class="flag-body"><p>{p}</p></div>
            <div class="pg-foot"><button type="button" class="pg-next">{nxt}</button></div>
          </div>
        </article>"""
acc=f"""<section class="hx-sec hx-tools" id="tools">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal"><span class="hx-kicker">Three tools</span><h2>Pick the moment. <em>We&rsquo;ll help with the words.</em></h2></div>
        <div class="deck hx-reveal" id="deck">
          <div class="deck-stage">
        {page('01','f1','practice','Before the talk','Say it out loud <em>before it&rsquo;s real</em>.','An AI plays your partner, so you can rehearse a hard conversation with nothing at stake. Afterwards you get a short debrief on what worked and what to try next.',pm,'Next','Partner Practice')}
        {page('02','f2','message','Before you send','Read it the way <em>they will</em>.','Paste a message before you send it. It shows how it may land and suggests a calmer, warmer or more direct version.',dm,'Next','Message check')}
        {page('03','f3','coach','When it hurts','A coach that <em>already knows</em> your story.','Tell it what happened. It remembers your partner and your past chats, so you never start from zero, even at 2am.',cm,'Next','Coach Chat')}
          </div>
          <p class="deck-gate" id="deck-gate" aria-live="polite"></p>
        </div>
      </div>
    </section>
    <script>(function(){{var deck=document.getElementById('deck');if(!deck)return;var st=deck.querySelector('.deck-stage'),P=[].slice.call(deck.querySelectorAll('.page')),D=[].slice.call(deck.querySelectorAll('.deck-dots button')),N=['Partner Practice','Message check','Coach Chat'],a=0,dir=1,ro;
function nat(p){{var c=p.querySelector('.pg-in').children,t=0;for(var k=0;k<c.length;k++)t+=c[k].offsetHeight;return t+26}}
function lay(){{var h=0;P.forEach(function(p){{h=Math.max(h,nat(p))}});st.style.height=h+'px';var nx=dir>0&&a<P.length-1?a+1:(dir<0&&a>0?a-1:(a>0?a-1:a+1)),fw=nx>a;P.forEach(function(p,i){{p.dataset.s=i<a?'turned':i==a?'front':i==a+1?'b1':'b2';p.style.height=h+'px';if(i==a){{p.removeAttribute('inert');p.removeAttribute('aria-hidden');p.querySelector('.pg-next').innerHTML=(fw?'Next: ':'Back: ')+N[nx]+(fw?' &rarr;':' &larr;');p.querySelector('.pg-turn').textContent=fw?'Next':'Back'}}else{{p.setAttribute('inert','');p.setAttribute('aria-hidden','true')}}}});D.forEach(function(d,i){{d.classList.toggle('on',i==a);d.setAttribute('aria-selected',i==a)}})}}
function go(n){{a=n;seen[n]=1;lay();upd();if(window.ResizeObserver&&!ro){{ro=new ResizeObserver(lay);P.forEach(function(p){{[].slice.call(p.querySelector('.pg-in').children).forEach(function(c){{ro.observe(c)}})}})}}}}
function step(){{if(a==P.length-1)dir=-1;else if(a==0)dir=1;go(a+dir)}}
deck.classList.add('js');
var gate=document.getElementById('deck-gate'),sec=document.getElementById('tools'),seen={{}},locked=false;
function after(t){{if(!t)return false;var p=sec.compareDocumentPosition(t);return !!(p&4)&&!(p&16)}}
function upd(){{var n=Object.keys(seen).length;if(!locked)return;gate.innerHTML='Open all three to continue <b>'+n+'/3</b>';if(n>=P.length){{locked=false;document.body.classList.remove('gated');gate.innerHTML='All seen. Keep scrolling';setTimeout(function(){{var t=document.querySelector('.hx-tools-end');if(t)window.scrollTo({{top:t.getBoundingClientRect().top+window.scrollY-110,behavior:'smooth'}});gate.innerHTML=''}},750)}}}}
function free(){{if(!locked)return;locked=false;document.body.classList.remove('gated');gate.innerHTML=''}}
locked=true;document.body.classList.add('gated');function chk(){{try{{var ht=location.hash&&location.hash.length>1?document.querySelector(location.hash):null;if(after(ht))free()}}catch(x){{}}}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',chk);else chk();addEventListener('hashchange',chk);
document.addEventListener('click',function(e){{var l=e.target.closest&&e.target.closest('a[href^="#"]');if(!l||!locked)return;var h=l.getAttribute('href');if(h.length<2)return;try{{if(after(document.querySelector(h))){{e.preventDefault();var bu=document.getElementById('burger'),lk=document.getElementById('links');if(lk)lk.classList.remove('open');window.scrollTo({{top:deck.getBoundingClientRect().top+window.scrollY-110,behavior:'smooth'}});gate.classList.remove('nudge');void gate.offsetWidth;gate.classList.add('nudge')}}}}catch(x){{}}}});
P.forEach(function(p){{p.addEventListener('click',function(e){{if(!p.dataset.s||p.dataset.s!=='front')return;if(e.target.closest('.hx-demo, a, input, select, textarea')&&!e.target.closest('.pg-next'))return;step()}})}});
D.forEach(function(d){{d.addEventListener('click',function(){{var n=+d.dataset.go;if(n>a)dir=1;else if(n<a)dir=-1;go(n)}})}});
function hash(){{var m=location.hash&&document.querySelector('.page'+location.hash);if(m)go(+m.dataset.i)}}
addEventListener('hashchange',hash);addEventListener('resize',lay);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(lay);go(0);hash();}})();</script>"""
s=s[:a]+acc+s[b:]


# ---- About the founder
ABOUT_HTML = """
  <div class="about-modal" id="about" role="dialog" aria-modal="true" aria-labelledby="about-title" hidden>
    <div class="about-backdrop" data-close></div>
    <div class="about-scroll">
      <div class="about-wrap">
        <button type="button" class="about-close" data-close aria-label="Close"></button>
        <div class="about-card">
          <div class="about-side">
            <div class="about-tile"><svg viewBox="18 18 164 164" aria-hidden="true"><g transform="translate(100 100) rotate(0) translate(0 -13) scale(.8) translate(-50 -88)"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f9e1a8"/></g><g transform="translate(100 100) rotate(90) translate(0 -13) scale(.8) translate(-50 -88)"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f6b7c8"/></g><g transform="translate(100 100) rotate(180) translate(0 -13) scale(.8) translate(-50 -88)"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f9e1a8"/></g><g transform="translate(100 100) rotate(270) translate(0 -13) scale(.8) translate(-50 -88)"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f6b7c8"/></g></svg></div>
            <p class="about-name">Jonas</p>
            <p class="about-role">Founder, RelationshipAI</p>
            <span class="about-stamp">2:07 AM &middot; still awake</span>
          </div>
          <div class="about-body">
            <span class="section-tag">Our story</span>
            <h2 id="about-title">Built for the 2am moment.</h2>
            <p>RelationshipAI was founded by Jonas, who saw first-hand how much a calm, structured second perspective could improve his own relationship. Not by supplying ready-made answers, but by slowing the moment down, clarifying what he was actually feeling, and finding words that would not make things worse.</p>
            <p>The hardest conversations rarely happen at convenient times. They happen late at night, with a message half typed and a mind that will not settle. That is when support is most valuable and least available, and it is the gap RelationshipAI was created to close.</p>
            <p>The results were strong enough that Jonas recognised the same approach could serve everyday people, not only those in therapy or in crisis. Today, RelationshipAI is built for anyone who has ever stared at a message and wondered how to say it right.</p>
            <p class="about-sign">Guided by established couples therapy methods, and clear about where professional support takes over.</p>
          </div>
        </div>
      </div>
    </div>
  </div>"""
FOOT_HTML = """<footer class="hx-foot">
    <div class="hx-wrap">
      <div class="ft-band"><b>Inspired by</b><span>The Gottman Method</span><span>Attachment theory</span><span>Nonviolent Communication</span></div>
      <div class="ft-main">
        <a href="index.html" class="hx-brand ft-logo"><img src="logo-tile.svg" alt="" width="38" height="38" /><span>Relationship<b>AI</b></span></a>
        <div class="ft-grid">
          <div class="ft-col">
            <h4>Product</h4>
            <a href="#learn-coach" data-feature="coach" data-umami-event="footer-feature-coach">Coach Chat</a>
            <a href="#learn-message" data-feature="message" data-umami-event="footer-feature-message">Message check</a>
            <a href="#learn-practice" data-feature="practice" data-umami-event="footer-feature-practice">Partner Practice</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div class="ft-col">
            <h4>About</h4>
            <a href="#about" class="ft-about" data-about data-umami-event="click-about-footer">About us</a>
            <a href="/blog/">Blog</a>
            <a href="method.html">Our method</a>
          </div>
          <div class="ft-col">
            <h4>Help</h4>
            <a href="#faq">FAQ</a>
            <a href="#join">Early access</a>
            <a href="privacy.html">Privacy Policy</a>
            <a href="terms.html">Terms of Use</a>
          </div>
          <div class="ft-col">
            <h4>Social</h4>
            <a href="https://www.instagram.com/relationshipai_/" target="_blank" rel="noopener noreferrer" class="ft-ig" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-footer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></svg><span>@relationshipai_</span></a>
          </div>
        </div>
      </div>
      <div class="ft-base">
        <p class="ft-copy">&copy; 2026 RelationshipAI</p>
        <p>RelationshipAI is an AI tool for personal growth and does not replace professional psychological or therapeutic care. If you&rsquo;re in a crisis, please contact a professional or a helpline in your country.</p>
      </div>
    </div>
  </footer>"""
ABOUT_JS = """<script>(function(){var m=document.getElementById('about');if(!m)return;var last=null;
function open(){last=document.activeElement;m.hidden=false;document.body.classList.add('about-open');var c=m.querySelector('.about-close');if(c)c.focus();if(location.hash!=='#about')history.replaceState(null,'','#about')}
function close(){m.hidden=true;document.body.classList.remove('about-open');if(location.hash==='#about')history.replaceState(null,'',location.pathname+location.search);if(last&&last.focus)last.focus()}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href="#about"]');if(a){e.preventDefault();e.stopPropagation();open();return}if(e.target.closest&&e.target.closest('[data-close]'))close()},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden)close()});
if(location.hash==='#about')open();})();</script>"""
PRICE_JS = """<script>(function(){var mq=window.matchMedia('(max-width:760px)'),s=document.getElementById('pricing');if(!s)return;
var b=document.createElement('button');b.type='button';b.className='pr-close';b.setAttribute('aria-label','Close pricing');var k=document.createElement('button');k.type='button';k.className='pr-back';k.setAttribute('aria-label','Back');k.innerHTML='<i></i>Back';var bar=document.createElement('div');bar.className='pr-bar';var ti=document.createElement('b');ti.textContent='Pricing';bar.appendChild(k);bar.appendChild(ti);bar.appendChild(b);document.body.appendChild(bar);k.addEventListener('click',function(){close()});
function open(){[].forEach.call(s.querySelectorAll('.hx-reveal'),function(e){e.classList.add('in')});document.body.classList.add('pricing-open');s.scrollTop=0;if(location.hash!=='#pricing')history.replaceState(null,'','#pricing')}
function close(){document.body.classList.remove('pricing-open');if(location.hash==='#pricing')history.replaceState(null,'',location.pathname+location.search)}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;var a=t.closest('a[href="#pricing"]');if(a&&mq.matches){e.preventDefault();open();return}if(document.body.classList.contains('pricing-open')&&t.closest('#pricing a[href="#join"]'))close()},true);
b.addEventListener('click',close);addEventListener('keydown',function(e){if(e.key==='Escape')close()});
if(mq.addEventListener)mq.addEventListener('change',function(){if(!mq.matches)close()});
if(location.hash==='#pricing'&&mq.matches)setTimeout(open,0);})();</script>"""
CMP_JS = """<script>(function(){
function mk(wrapSel,title,where){var w=document.querySelector(wrapSel);if(!w)return;var tb=w.querySelector('table');if(!tb)return;
var btn=document.createElement('button');btn.type='button';btn.className='cmp-open';btn.innerHTML='View full table <span>&#x2922;</span>';
if(where==='before')w.insertBefore(btn,w.firstChild);else w.parentNode.appendChild(btn);
var sh=document.createElement('div');sh.className='cmp-sheet';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label',title);
sh.innerHTML='<div class="cmp-bar"><b>'+title+'</b><span class="cmp-ctl"><button type="button" data-z="-1" aria-label="Zoom out"></button><button type="button" data-z="1" aria-label="Zoom in"></button><button type="button" class="cmp-x" aria-label="Close"></button></span></div><div class="cmp-scroll"></div><p class="cmp-hint">Pinch or use + / &minus; to zoom. Drag to move around.</p>';
document.body.appendChild(sh);var sc=sh.querySelector('.cmp-scroll'),t=null,Z=[.55,.75,1,1.3,1.7],zi=0;
function zoom(){if(t)t.style.zoom=Z[zi]}
function open(){if(!t){t=tb.cloneNode(true);sc.appendChild(t)}zi=0;zoom();sh.hidden=false;document.body.classList.add('cmp-open-b');sc.scrollTop=0;sc.scrollLeft=0}
function close(){sh.hidden=true;document.body.classList.remove('cmp-open-b')}
btn.addEventListener('click',open);sh.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.classList.contains('cmp-x'))close();else if(b.dataset.z){zi=Math.max(0,Math.min(Z.length-1,zi+ +b.dataset.z));zoom()}});
addEventListener('keydown',function(e){if(e.key==='Escape'&&!sh.hidden)close()})}
mk('#compare .compare-table-wrap','How it stacks up','after');
mk('#pricing .plan-compare-wrap','Compare every feature','before');
})();</script>"""
FIT_JS = """<script>(function(){function fit(){var d=document.documentElement,w=window.innerWidth;if(d.scrollWidth>w+1){var m=document.querySelector('meta[name=viewport]');if(m){m.setAttribute('content','width='+w+', initial-scale=1');setTimeout(function(){m.setAttribute('content','width=device-width, initial-scale=1.0')},60)}window.scrollTo(0,window.scrollY)}}window.addEventListener('load',fit);window.addEventListener('orientationchange',function(){setTimeout(fit,300)});setTimeout(fit,1200)})();</script>"""
ACC_JS = """<script>(function(){var D=[['more','More tools','Small tools after the chat ends'],['compare','How it compares','Versus a generic chatbot and therapy'],['trust','Privacy &amp; trust','What you tell it stays yours'],['approach','Our approach','Why it is built the way it is'],['pricing','Pricing','Free, Pro and Premium'],['blog','From the blog','Relationship advice, tips &amp; guides'],['faq','FAQ','Answers to common questions']];
var all={};
D.forEach(function(d){var sec=document.getElementById(d[0]);if(!sec)return;
 var b=document.createElement('button');b.type='button';b.className='acc-btn';b.setAttribute('aria-expanded','false');b.innerHTML='<span class="acc-t"><b>'+d[1]+'</b><small>'+d[2]+'</small></span><i class="acc-i" aria-hidden="true"></i>';
 sec.insertBefore(b,sec.firstChild);sec.classList.add('acc','acc-closed');all[d[0]]=[sec,b];
 b.addEventListener('click',function(){tog(d[0])})});
function set(id,open){var x=all[id];if(!x)return;x[0].classList.toggle('acc-closed',!open);x[1].setAttribute('aria-expanded',open?'true':'false');if(open)[].forEach.call(x[0].querySelectorAll('.hx-reveal'),function(e){e.classList.add('in')})}
function tog(id){var x=all[id];set(id,x[0].classList.contains('acc-closed'))}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1);if(all[id]&&window.matchMedia('(max-width:760px)').matches){set(id,true);setTimeout(function(){all[id][0].scrollIntoView({behavior:'smooth',block:'start'})},60)}},true);
if(location.hash&&all[location.hash.slice(1)])set(location.hash.slice(1),true);})();</script>"""
import re as _re

# ---- feature windows (opened from the footer Product links)
def _ico(d): return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'
I_CHAT=_ico('<path d="M4 5h16v11H9l-5 4z"/>')
I_COMPASS=_ico('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>')
I_HEART=_ico('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')
I_EYE=_ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')
I_SPARK=_ico('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>')
I_HAND=_ico('<path d="M5 12l4 4L19 6"/>')
I_BRAIN=_ico('<path d="M3 12h4l3-7 4 14 3-7h4"/>')
I_MOON=_ico('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>')
I_LOOP=_ico('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>')
PH_PRACTICE=('<div class="hs on"><div class="hs-top"><i></i>Partner Practice</div><div class="hs-lbl">Rehearse the hard talk first</div>'
 '<div class="bb me">You always cancel on me.</div><div class="bb ai">Here we go again. I was just tired.</div>'
 '<div class="hs-card bt"><small>Coach note</small>Starting with blame made them defensive. <b>Try:</b> &ldquo;I felt hurt when plans fell through.&rdquo;</div>'
 '<div class="hs-inp"><span>Say it your way&hellip;</span><b>&uarr;</b></div></div>')
PH_MESSAGE=('<div class="hs on"><div class="hs-top"><i></i>Message check</div><div class="hs-lbl">Your draft</div>'
 '<div class="hs-card pk">Fine. Do whatever you want.<span>Reads as cold &middot; likely to start a fight</span></div><div class="hs-arrow">&darr;</div>'
 '<div class="hs-lbl">Says what you actually mean</div><div class="hs-card bt">I&rsquo;m upset you didn&rsquo;t tell me. Can we talk tonight?<span>Honest, calm, invites a reply</span></div>'
 '<div class="hs-chips"><b>Calmer</b><i>Warmer</i><i>Direct</i></div></div>')
PH_COACH=('<div class="hs on"><div class="hs-top"><i></i>Coach Chat</div><div class="hs-lbl">2:07 AM &middot; can&rsquo;t sleep</div>'
 '<div class="bb me">He went quiet again.</div><div class="hs-mem"><i></i>Remembers: he withdraws when stressed</div>'
 '<div class="bb ai">That&rsquo;s his stress pattern, not rejection.</div><div class="hs-card bt"><small>Tomorrow, try</small>&ldquo;I miss you. Can we talk after dinner?&rdquo;</div>'
 '<div class="hs-inp"><span>Tell it what happened&hellip;</span><b>&uarr;</b></div></div>')
FEATS=[
 dict(id='practice',tag='Partner Practice',when='Before the talk',tint='#f7d99a',
  h='Say it out loud <em>before it&rsquo;s real.</em>',
  sub='Rehearse a hard conversation with an AI that plays your partner. Nothing is at stake, so you can find the words that actually land.',
  phone=PH_PRACTICE,
  goalh='The goal: walk into the talk calm, not defensive.',
  goal='Most hard conversations go wrong in the first sentence. It comes out as blame, the other person defends, and the real point gets lost. Partner Practice lets you try that first sentence, and the next ten, before it counts.',
  helps=[(I_CHAT,'Try it as many ways as you like','Say it one way, then another. The AI answers the way a real person might, so you feel how each version lands.'),
         (I_COMPASS,'A short debrief afterwards','You get a few lines on what worked, what made things tense, and one thing to try next.'),
         (I_HEART,'Softer starts, same message','Lead with how you feel and what you need, not with what they did wrong.')],
  good=['Raising something you have avoided','Asking for more time together','Saying sorry properly','Setting a boundary','Talking to a parent, ex or boss (Pro)'],
  steps=[('Pick who and what','<div class="fm-note"><small>Who</small>My partner</div><div class="fm-note alt"><small>What I want to say</small>You cancelled plans again.</div>'),
         ('Rehearse the talk','<div class="fm-b me">I felt hurt when plans fell through.</div><div class="fm-b ai">I didn&rsquo;t realise. I&rsquo;m sorry.</div>'),
         ('Read the debrief','<div class="fm-note"><small>What worked</small>You started with how you felt, not with blame.</div><div class="fm-note alt"><small>Try next</small>Add what you need from them.</div>')],
  avail='Free: 1 rehearsal (up to 8 messages) with a debrief. Pro: unlimited rehearsals, with a partner, ex, parent or boss.'),
 dict(id='message',tag='Message check',when='Before you send',tint='#f8c7a3',
  h='Read it the way <em>they will.</em>',
  sub='Paste a message before you send it. See how it may land, then pick a calmer, warmer or more direct version.',
  phone=PH_MESSAGE,
  goalh='The goal: stop a text from starting a fight you did not mean to start.',
  goal='Short messages lose their tone. &ldquo;Fine. Do whatever you want.&rdquo; can read as cold or as hurt, and the other person will pick one. Message check shows how a draft may read and gives you versions that say what you actually mean.',
  helps=[(I_EYE,'See how it may land','Spot cold, sharp or confusing wording before the other person does.'),
         (I_SPARK,'Three ways to say it','Calmer, warmer or more direct. Keep your point, change the delivery.'),
         (I_HAND,'Your words, your call','Nothing is sent for you. You decide what, if anything, to send.')],
  good=['Replying when you are angry','An apology you keep rewriting','A text after a long silence','Saying no kindly','Messages with a lot riding on them'],
  steps=[('Paste your draft','<div class="fm-b me">Fine. Do whatever you want.</div>'),
         ('See how it reads','<div class="fm-note pk"><small>Reads as</small>Cold. Likely to start a fight.</div>'),
         ('Pick a version','<div class="fm-note"><small>Calmer</small>I&rsquo;m upset you didn&rsquo;t tell me. Can we talk tonight?</div>')],
  avail='Free: 3 tries. Pro: 10 a day, with two rewrites each.'),
 dict(id='coach',tag='Coach Chat',when='When it hurts',tint='#f4b8c4',
  h='A coach that <em>already knows</em> your story.',
  sub='Tell it what happened. It remembers your partner and your past chats, so you never start from zero, even at 2am.',
  phone=PH_COACH,
  goalh='The goal: understand what is going on and decide what to say, instead of spiralling.',
  goal='After a fight or a long silence your head loops. Coach Chat helps you slow down, notices patterns across your chats, such as how someone reacts when stressed, and ends with one small thing to try.',
  helps=[(I_MOON,'Remembers your story','Your partner and your past chats stay in context, so the advice fits your situation.'),
         (I_LOOP,'Spots patterns','Notices what keeps repeating, using well-known couples methods like Gottman and attachment theory.'),
         (I_COMPASS,'Ends with a next step','Not only comfort. One thing to say or do tomorrow.')],
  good=['After a fight','When you cannot sleep','When they went quiet','Overthinking a message','Making sense of a pattern'],
  steps=[('Tell it what happened','<div class="fm-b me">He went quiet again.</div>'),
         ('It connects the dots','<div class="fm-mem">Remembers: he withdraws when stressed</div><div class="fm-b ai">That&rsquo;s his stress pattern, not rejection.</div>'),
         ('Take one thing with you','<div class="fm-note"><small>Tomorrow, try</small>&ldquo;I miss you. Can we talk after dinner?&rdquo;</div>')],
  avail='Free: 8 messages a day, with memory of your chats.'),
]
def _panel(i,f):
    nxt=FEATS[(i+1)%len(FEATS)]
    helps=''.join('<div class="fm-hi"><span class="fm-ic">%s</span><h4>%s</h4><p>%s</p></div>'%h for h in f['helps'])
    good=''.join('<li>%s</li>'%g for g in f['good'])
    steps=''.join('<div class="fm-step"><span class="fm-sn">%d</span><h4>%s</h4><div class="fm-snip">%s</div></div>'%(n+1,t,html) for n,(t,html) in enumerate(f['steps']))
    return ('<article class="fm-panel" id="learn-%s" data-f="%s" hidden style="--tint:%s">'
     '<div class="fm-hero"><div class="fm-copy"><span class="fm-kick"><b>%s</b><span>%s</span></span><h2 id="fm-title-%s">%s</h2><p class="fm-sub">%s</p>'
     '<div class="fm-cta"><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-feature-%s">Get early access</a><span class="hx-free">Free to try</span></div></div>'
     '<div class="fm-art"><div class="hph fm-phone"><div class="hph-frame"><i class="hph-notch"></i><div class="hph-scr">%s</div></div></div></div></div>'
     '<div class="fm-sec fm-goal"><h3>%s</h3><p>%s</p></div>'
     '<div class="fm-sec"><h3 class="fm-h">How it helps</h3><div class="fm-helps">%s</div></div>'
     '<div class="fm-sec fm-goodwrap"><h3 class="fm-h">Good for</h3><ul class="fm-good">%s</ul></div>'
     '<div class="fm-sec"><h3 class="fm-h">How it works</h3><div class="fm-steps">%s</div></div>'
     '<div class="fm-avail"><b>What you get</b><span>%s</span></div>'
     '<div class="fm-foot"><p>Not a replacement for therapy. If you are in a crisis, please contact a professional or a helpline in your country.</p>'
     '<button type="button" class="fm-next" data-go="%s">Next: %s <span aria-hidden="true">&rarr;</span></button></div>'
     '</article>')%(f['id'],f['id'],f['tint'],f['tag'],f['when'],f['id'],f['h'],f['sub'],f['id'],f['phone'],f['goalh'],f['goal'],helps,good,steps,f['avail'],nxt['id'],nxt['tag'])
FM_HTML=('<div class="fm" id="feature" role="dialog" aria-modal="true" aria-label="Feature details" hidden>'
 '<div class="about-backdrop" data-fclose></div><div class="fm-scroll"><div class="fm-wrap"><button type="button" class="about-close" data-fclose aria-label="Close"></button>'
 '<div class="fm-card">'+''.join(_panel(i,f) for i,f in enumerate(FEATS))+'</div></div></div></div>')
FM_JS = """<script>(function(){var m=document.getElementById('feature');if(!m)return;var P=[].slice.call(m.querySelectorAll('.fm-panel')),last=null,cur=null;
function show(id){P.forEach(function(p){p.hidden=p.dataset.f!==id});cur=id;var sc=m.querySelector('.fm-scroll');if(sc)sc.scrollTop=0;var a=m.querySelector('.fm-panel:not([hidden]) h2');if(a)m.setAttribute('aria-labelledby',a.id)}
function open(id){if(m.hidden)last=document.activeElement;show(id);m.hidden=false;document.body.classList.add('about-open');var c=m.querySelector('.about-close');if(c)c.focus();history.replaceState(null,'','#learn-'+id)}
function close(){m.hidden=true;document.body.classList.remove('about-open');if(/^#learn-/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);if(last&&last.focus)last.focus()}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;var f=t.closest('[data-feature]');if(f){e.preventDefault();e.stopPropagation();open(f.getAttribute('data-feature'));return}
var n=t.closest('.fm-next');if(n){show(n.getAttribute('data-go'));history.replaceState(null,'','#learn-'+cur);return}
if(t.closest('[data-fclose]')&&!m.hidden){var link=t.closest('a[href^="#"]');close();if(!link)return}},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden)close()});
var h=location.hash.match(/^#learn-(practice|message|coach)$/);if(h)open(h[1]);})();</script>"""

s=_re.sub(r'<footer class="hx-foot">.*?</footer>',lambda mo:FOOT_HTML,s,count=1,flags=_re.S)
s=s.replace('</footer>','</footer>'+ABOUT_HTML+ABOUT_JS+FM_HTML+FM_JS+CMP_JS+ACC_JS+FIT_JS,1)

# ---- blog thumbnails on the home cards (shown on mobile only)
import glob as _g, os as _os
def _thumb(m):
    slug=m.group(1); f=_g.glob('/root/site/img/blog/*-%s-1.svg'%slug)
    if not f: return m.group(0)
    src='/img/blog/'+_os.path.basename(f[0])+'?v=2'
    return m.group(0)+'\n  <span class="post-thumb"><img src="%s" alt="" width="800" height="450" loading="lazy" decoding="async" /></span>'%src
s=_re.sub(r'<a class="post-card" href="/blog/([^/"]+)/">',_thumb,s)

# ---- final CTA: add clover decoration
s=s.replace('<div class="hx-final hx-reveal">','<div class="hx-final hx-reveal">'+clover('fclover','f'))
# footer clover
s=s.replace('<body class="hx">','<body class="hx">'+PGBG,1)
open('/root/lp/index.html','w').write(s)
print('ok',len(s))
