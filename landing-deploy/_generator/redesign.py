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
s=s.replace('css/home.css?v=11','css/home.css?v=142')
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
                  <div class="hs-top"><i></i>Coach Chat</div>
                  <div class="hs-lbl">2:07 AM &middot; can&rsquo;t sleep</div>
                  <div class="bb me">He went quiet again.</div>
                  <div class="hs-mem"><i></i>Remembers: he withdraws when stressed</div>
                  <div class="bb ai">That&rsquo;s his stress pattern, not rejection.</div>
                  <div class="hs-card bt"><small>Tomorrow, try</small>&ldquo;I miss you. Can we talk after dinner?&rdquo;</div>
                  <div class="hs-inp"><span>Tell it what happened&hellip;</span><b>&uarr;</b></div>
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
                <div class="hph-tabs"><button type="button" class="on" data-i="0" aria-label="Partner Practice">Practice</button><button type="button" data-i="1" aria-label="Coach Chat">Coach</button><button type="button" data-i="2" aria-label="Message check">Check</button></div>
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
tools_end=''
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
def page(n,cls,idn,when,h,p,vis,nxt,name='',ex=''):
    return f"""<article class="page {cls}" id="{idn}" data-i="{int(n)-1}">
          <div class="pg-in">
            <button type="button" class="pg-head"><span class="fnum">{n}</span><span class="ftxt"><small><b>{name}</b><span>{when}</span></small><h3>{h}</h3></span><span class="pg-turn" aria-hidden="true">Next</span></button>
            <div class="flag-body"><p>{p}</p></div>
            <div class="pg-foot"><button type="button" class="pg-next">{nxt}</button>{ex}</div>
          </div>
        </article>"""
XBUB='<a href="#learn-more" data-feature="more" class="xt-bub" data-umami-event="explore-more-tools"><span class="xt-bub-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M17 13.5v7M13.5 17h7"/></svg></span><span class="xt-bub-t"><b>Explore more tools</b><small>Nine more small tools</small></span><i class="xt-bub-go" aria-hidden="true"></i></a>'
acc=f"""<section class="hx-sec hx-tools" id="tools">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal"><span class="hx-kicker">Three tools</span><h2>Pick the moment. <em>We&rsquo;ll help with the words.</em></h2></div>
        <div class="deck hx-reveal" id="deck">
          <div class="deck-stage">
        {page('01','f1','practice','Before the talk','Say it out loud <em>before it&rsquo;s real</em>.','An AI plays your partner, so you can rehearse a hard conversation with nothing at stake. Afterwards you get a short debrief on what worked and what to try next.',pm,'Next','Partner Practice')}
        {page('02','f2','coach','When it hurts','A coach that <em>already knows</em> your story.','Tell it what happened. It remembers your partner and your past chats, so you never start from zero, even at 2am.',cm,'Next','Coach Chat')}
        {page('03','f3','message','Before you send','Read it the way <em>they will</em>.','Paste a message before you send it. It shows how it may land and suggests a calmer, warmer or more direct version.',dm,'Next','Message check',XBUB)}
          </div>
          <p class="deck-gate" id="deck-gate" aria-live="polite"></p>
        </div>
      </div>
    </section>
    <script>(function(){{var deck=document.getElementById('deck');if(!deck)return;var st=deck.querySelector('.deck-stage'),P=[].slice.call(deck.querySelectorAll('.page')),D=[].slice.call(deck.querySelectorAll('.deck-dots button')),N=['Partner Practice','Coach Chat','Message check'],a=0,dir=1,ro;
function nat(p){{var c=p.querySelector('.pg-in').children,t=0;for(var k=0;k<c.length;k++)t+=c[k].offsetHeight;return t+26}}
function lay(){{var h=0;P.forEach(function(p){{h=Math.max(h,nat(p))}});st.style.height=h+'px';var nx=dir>0&&a<P.length-1?a+1:(dir<0&&a>0?a-1:(a>0?a-1:a+1)),fw=nx>a;P.forEach(function(p,i){{p.dataset.s=i<a?'turned':i==a?'front':i==a+1?'b1':'b2';p.style.height=h+'px';if(i==a){{p.removeAttribute('inert');p.removeAttribute('aria-hidden');p.querySelector('.pg-next').innerHTML=(fw?'Next: ':'Back: ')+N[nx]+(fw?' &rarr;':' &larr;');p.querySelector('.pg-turn').textContent=fw?'Next':'Back'}}else{{p.setAttribute('inert','');p.setAttribute('aria-hidden','true')}}}});D.forEach(function(d,i){{d.classList.toggle('on',i==a);d.setAttribute('aria-selected',i==a)}})}}
function go(n){{a=n;seen[n]=1;lay();upd();if(window.ResizeObserver&&!ro){{ro=new ResizeObserver(lay);P.forEach(function(p){{[].slice.call(p.querySelector('.pg-in').children).forEach(function(c){{ro.observe(c)}})}})}}}}
function step(){{if(a==P.length-1)dir=-1;else if(a==0)dir=1;go(a+dir)}}
deck.classList.add('js');
var gate=document.getElementById('deck-gate'),sec=document.getElementById('tools'),seen={{}},locked=false;
function after(t){{if(!t)return false;var p=sec.compareDocumentPosition(t);return !!(p&4)&&!(p&16)}}
function upd(){{var n=Object.keys(seen).length;if(!locked)return;if(n<P.length){{gate.innerHTML='Open all three to continue <b>'+n+'/3</b>';return}}locked=false;gate.innerHTML='<span class="gate-ok"><i aria-hidden="true"></i>All three seen</span>';setTimeout(unveil,1700)}}
function unveil(){{var B=document.body,mob=window.matchMedia('(max-width:760px)').matches,calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;B.classList.remove('gated');var t=document.getElementById('approach');if(t&&mob&&t.classList.contains('acc-closed')){{var ab=t.querySelector('.acc-btn');if(ab)ab.click()}}
var xb=document.getElementById('xt-btn'),y=xb?xb.getBoundingClientRect().top+window.scrollY-(mob?104:170):(t?t.getBoundingClientRect().top+window.scrollY-(mob?96:150):window.scrollY);if(!calm)B.classList.add('unveil');
var from=window.scrollY,d=Math.min(1500,Math.max(900,Math.abs(y-from)*.9)),t0=null,stop=false;function halt(){{stop=true}}['wheel','touchstart','keydown','mousedown'].forEach(function(e){{addEventListener(e,halt,{{once:true,passive:true}})}});
function tick(n){{if(stop)return;if(t0===null)t0=n;var p=Math.min(1,(n-t0)/d),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;window.scrollTo({{top:from+(y-from)*e,behavior:'instant'}});if(p<1)requestAnimationFrame(tick)}}
if(calm)window.scrollTo({{top:y,behavior:'instant'}});else requestAnimationFrame(function(){{requestAnimationFrame(tick)}});
setTimeout(function(){{B.classList.remove('unveil');gate.innerHTML=''}},d+900)}}
function free(){{if(!locked)return;locked=false;document.body.classList.remove('gated');gate.innerHTML=''}}
locked=true;document.body.classList.add('gated');function chk(){{try{{var ht=location.hash&&location.hash.length>1?document.querySelector(location.hash):null;if(after(ht))free()}}catch(x){{}}}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',chk);else chk();addEventListener('hashchange',chk);
document.addEventListener('click',function(e){{var l=e.target.closest&&e.target.closest('a[href^="#"]');if(l&&l.hasAttribute('data-nogate')){{free();return}}if(!l||!locked)return;var h=l.getAttribute('href');if(h.length<2)return;try{{if(after(document.querySelector(h))){{e.preventDefault();var bu=document.getElementById('burger'),lk=document.getElementById('links');if(lk)lk.classList.remove('open');window.scrollTo({{top:deck.getBoundingClientRect().top+window.scrollY-110,behavior:'smooth'}});gate.classList.remove('nudge');void gate.offsetWidth;gate.classList.add('nudge')}}}}catch(x){{}}}});
P.forEach(function(p){{p.addEventListener('click',function(e){{if(!p.dataset.s||p.dataset.s!=='front')return;if(e.target.closest('.hx-demo, a, input, select, textarea')&&!e.target.closest('.pg-next'))return;step()}})}});
D.forEach(function(d){{d.addEventListener('click',function(){{var n=+d.dataset.go;if(n>a)dir=1;else if(n<a)dir=-1;go(n)}})}});
function hash(){{var m=location.hash&&document.querySelector('.page'+location.hash);if(m)go(+m.dataset.i)}}
addEventListener('hashchange',hash);addEventListener('resize',lay);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(lay);go(0);hash();}})();</script>"""
s=s[:a]+acc+s[b:]


# ---- About the founder

WINBG='<div class="page-bg" aria-hidden="true">'+''.join(f'<span class="pbg" style="top:{t}px;{sd}:{o}%;--s:{sc};--r:{r}deg;--o:{op}">'+clover('','pg')+'</span>' for t,sd,sc,r,o,op in [(160,'left',26,20,-9,0.5),(760,'right',24,10,-9,0.58),(1500,'left',24,-12,-9,0.5),(2250,'right',26,20,-6,0.5),(3000,'left',28,32,-9,0.5),(3800,'right',24,-24,-8,0.5)])+'</div>'
def _wnav(attr):
    return ('<div class="fm-nav"><div class="hx-wrap"><button type="button" class="hx-brand fm-brand" aria-label="Close and return to the page" %s><img src="logo-tile.svg" alt="" width="38" height="38" /><span>Relationship<b>AI</b></span></button>'
            '<button type="button" class="about-close" %s aria-label="Close"></button></div></div>')%(attr,attr)
def _wrapbody(h):
    i=h.index('<section'); j=h.index('<div class="fm-foot">')
    return h[:i]+'<div class="fm-body">'+h[i:j]+'</div>'+h[j:]
ABOUT_HTML = """
  <div class="about-modal" id="about" role="dialog" aria-modal="true" aria-labelledby="about-title" hidden>
    <div class="about-backdrop" data-close></div>
    <div class="about-scroll">
      <div class="about-wrap">"""+WINBG+_wnav('data-close')+"""
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
            <div class="about-cta"><a href="#join" class="hx-btn" data-close data-umami-event="cta-about-end">Get early access</a><a href="method.html" class="hx-btn ghost" data-umami-event="about-method">Our method <span aria-hidden="true">&rarr;</span></a></div>
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
            <a href="#learn-practice" data-feature="practice" data-umami-event="footer-feature-practice">Partner Practice</a>
            <a href="#learn-coach" data-feature="coach" data-umami-event="footer-feature-coach">Coach Chat</a>
            <a href="#learn-message" data-feature="message" data-umami-event="footer-feature-message">Message check</a>
            <a href="#learn-more" data-feature="more" data-umami-event="footer-feature-more">Other tools</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div class="ft-col">
            <h4>About</h4>
            <a href="#about" class="ft-about" data-about data-umami-event="click-about-footer">About us</a>
            <a href="method.html">Our method</a>
          </div>
          <div class="ft-col">
            <h4>From the blogs</h4>
            <a href="#learn-blog-attachment" data-feature="blog-attachment" data-umami-event="footer-blog-attachment">Attachment styles</a>
            <a href="#learn-blog-communication" data-feature="blog-communication" data-umami-event="footer-blog-communication">Communication</a>
            <a href="#learn-blog-conflict" data-feature="blog-conflict" data-umami-event="footer-blog-conflict">Conflict</a>
            <a href="#learn-blog-repair" data-feature="blog-repair" data-umami-event="footer-blog-repair">Repairing a relationship</a>
            <a href="#learn-blog-overthinking" data-feature="blog-overthinking" data-umami-event="footer-blog-overthinking">Overthinking</a>
          </div>
          <div class="ft-col">
            <h4>Support</h4>
            <a href="#learn-support" data-feature="support" data-umami-event="footer-support">Contact us</a>
            <a href="#faq">FAQ</a>
            <a href="#join">Early access</a>
            <a href="privacy.html">Privacy Policy</a>
            <a href="terms.html">Terms of Use</a>
          </div>
          <div class="ft-col">
            <h4>Social</h4>
            <div class="ft-soc"><a href="https://www.instagram.com/relationshipai_/" target="_blank" rel="noopener noreferrer" class="ft-ig" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-footer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></svg></a><a href="https://www.pinterest.com/relationshipai_/" target="_blank" rel="noopener noreferrer" class="ft-ig ft-pin" aria-label="Pinterest @relationshipai_" data-umami-event="click-pinterest-footer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.972 5.367 18.605 0 12.017 0z"/></svg></a></div>
          </div>
        </div>
      </div>
      <div class="ft-base">
        <p class="ft-copy">&copy; 2026 RelationshipAI</p>
        <p>RelationshipAI is an AI tool for personal growth and does not replace professional psychological or therapeutic care. If you&rsquo;re in a crisis, please contact a professional or a helpline in your country.</p>
      </div>
    </div>
  </footer>"""

def _fsite():
    f=FOOT_HTML
    f=re.sub(r'<a href="(#(?!about|learn)[^"]*)"',lambda m:'<a href="%s" data-fclose'%m.group(1),f)
    return '<div class="fm-site">'+f+'</div>'
FSITE=_fsite()
_tail='\n      </div>\n    </div>\n  </div>'
assert ABOUT_HTML.endswith(_tail)
ABOUT_HTML=ABOUT_HTML[:-len(_tail)]+FSITE+_tail
ABOUT_JS = """<script>(function(){var m=document.getElementById('about');if(!m)return;var last=null,io=null,sc=m.querySelector('.about-scroll');
function fmOpen(){var f=document.getElementById('feature');return f&&!f.hidden}
function arm(){if(io)io.disconnect();var T=[].slice.call(m.querySelectorAll('.rv,.ab-end h3,.ab-end .fm-cta'));T.forEach(function(e,i){e.classList.add('rv');e.classList.remove('in');if(e.matches('.ab-i'))e.style.transitionDelay=([].indexOf.call(e.parentNode.children,e)*90)+'ms'});
if(!('IntersectionObserver' in window)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){T.forEach(function(e){e.classList.add('in')});return}
io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{root:sc,threshold:.12,rootMargin:'0px 0px -6% 0px'});T.forEach(function(e){io.observe(e)})}
function show(){m.hidden=false;document.body.classList.add('about-open');var c=m.querySelector('.about-close');if(c)c.focus();if(sc)sc.scrollTop=0;arm()}
function hide(){m.hidden=true;if(!fmOpen())document.body.classList.remove('about-open');if(last&&last.focus)last.focus()}
function open(init){last=document.activeElement;show();if(init)history.replaceState(null,'','#about');else history.pushState({ab:1},'','#about')}
function clean(){if(location.hash==='#about')history.replaceState(null,'',location.pathname+location.search)}
function close(){if(history.state&&history.state.ab)history.back();else{hide();clean()}}
window.addEventListener('popstate',function(){if(location.hash==='#about'){if(m.hidden)show()}else if(!m.hidden)hide()});
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;var a=t.closest('a[href="#about"]');if(a){e.preventDefault();e.stopPropagation();if(m.hidden)open();return}
if(m.hidden)return;var f=t.closest('[data-feature]');if(f||t.closest('a[href^="#"]')){hide();if(history.state&&history.state.ab)history.replaceState(null,'',location.pathname+location.search);else clean();return}
if(t.closest('[data-close]')||t.classList.contains('about-scroll')||t.classList.contains('about-wrap'))close()},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden)close()});
if(location.hash==='#about')open(true);})();</script>"""
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
ACC_JS = """<script>(function(){var D=[['compare','How it compares','Versus a generic chatbot and therapy'],['trust','Privacy &amp; trust','What you tell it stays yours'],['approach','Our approach','Why it is built the way it is'],['pricing','Pricing','Free, Pro and Premium'],['blog','From the blog','Relationship advice, tips &amp; guides'],['faq','FAQ','Answers to common questions']];
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
  h='A couples coach that <em>gets the whole picture.</em>',
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

# ---- richer content: everything each feature can do (taken from how the app actually works)
I_MEM=_ico('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>')
I_PEOPLE=_ico('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.3"/>')
I_BOOK=_ico('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>')
I_LIST=_ico('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>')
I_BELL=_ico('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>')
I_IMG=_ico('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>')
I_MIC=_ico('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>')
I_DOC=_ico('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>')
I_Q=_ico('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8M12 17h.01"/>')
I_SCALE=_ico('<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/>')
I_GAUGE=_ico('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>')
I_FLAME=_ico('<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2-.5-3 .5-5 1-8z"/>')
I_LOCK=_ico('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
I_PAUSE=_ico('<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>')
I_QUOTE=_ico('<path d="M5 6h6v6H8c0 2 1 3 3 3M13 6h6v6h-3c0 2 1 3 3 3"/>')
I_TREND=_ico('<path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/>')
I_PEN=_ico('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>')
I_CHECKLIST=_ico('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>')
X={}
X['practice']=dict(
 sub='An AI plays your partner, in character, so you can rehearse the hard conversation, get a debrief and a readiness score, and walk in knowing how it can go.',
 goalh='The goal: walk into the real talk having already had it once.',
 goal='Hard conversations go wrong in the first sentence, and you rarely get a second try. Partner Practice gives you the second try first: an AI that answers like the real person, honest feedback on what you said, and a clear sense of when you are ready.',
 capsh='Everything Partner Practice does',
 caps=[(I_PEOPLE,'Plays your partner, in character','Create a profile with their name, personality and the context. The AI answers as they would, so the pushback feels real.',''),
  (I_MEM,'Learns who they are from your chats','It builds a picture of your partner from your past Coach Chat conversations: traits, communication patterns, how they tend to react.',''),
  (I_QUOTE,'Learns from their real words','Paste messages they have actually sent. It picks up how they phrase things and rehearses in that voice.',''),
  (I_LIST,'A debrief after every rehearsal','What went well, what to watch for, and one concrete tip for the real conversation.',''),
  (I_GAUGE,'A readiness score, 1 to 10','One honest number for how ready you seem, so you know when to keep practising and when you are set.',''),
  (I_PEN,'A talk plan before you start','An opening line, what to avoid and how to respond if it heats up, linked to your rehearsal.','Premium'),
  (I_FLAME,'Hard mode','Turn up the pushback: defensive, cold or angry reactions, so the real talk feels easier.','Premium'),
  (I_TREND,'See your progress','How your readiness changes across rehearsals with the same person.','Premium'),
  (I_PEOPLE,'Practise with anyone','Partner, ex, parent or boss. Save more than one profile. Any language.','Pro')],
 steps=[('Set up the person','<div class="fm-note"><small>Who</small>Alex, my partner. Gets defensive when criticised.</div><div class="fm-note alt"><small>Optional</small>Paste messages Alex really sent</div>'),
        ('Rehearse the talk','<div class="fm-b me">I miss you. Could we keep Thursday evenings for us?</div><div class="fm-b ai">I&rsquo;d like that. I didn&rsquo;t realise it felt that way.</div>'),
        ('Get the debrief','<div class="fm-note"><small>Went well</small>You started with a feeling, not blame.</div><div class="fm-note alt"><small>Readiness</small>8 / 10. Add what you will offer too.</div>')])
X['coach']=dict(
 sub='Talk it through at any hour with a coach that asks the right questions, remembers your story, tells you the honest part, and ends with a plan you can follow.',
 goalh='The goal: see your situation clearly, then know what to do next.',
 goal='Coach Chat works like a thoughtful, honest couples coach. It first learns what is really going on, then names what keeps happening, then helps you decide and plan. Spotting patterns is only one part of it.',
 capsh='Everything Coach Chat does',
 caps=[(I_Q,'Asks before it advises','One to three specific questions first, so the advice fits your situation and not a generic couple.',''),
  (I_LOOP,'Names the pattern','Spots cycles like pursue and withdraw, gives them a plain name and reuses it, so you can see it next time.',''),
  (I_MEM,'Remembers you and your partner','Keeps context across chats and builds a picture of your partner, so you never start from zero.',''),
  (I_SCALE,'Honest, not a yes-machine','It does not just agree. It considers what your partner would say, and kindly names your share.',''),
  (I_BOOK,'Draws on real couples methods','Gottman, Emotionally Focused Therapy, CBT, nonviolent communication, Imago and more, blended to fit you.',''),
  (I_CHECKLIST,'Plans, not just comfort','Concrete pieces of work: a weekly relationship talk, a time-out agreement, a listening exercise, with when and how.',''),
  (I_BELL,'Try-this cards that follow up','Save a suggestion as an experiment. Two days later it asks how it went and adjusts the next step.',''),
  (I_IMG,'Reads screenshots, hears your voice','Add photos or screenshots of the real conversation, or dictate. It replies in the language you write in.',''),
  (I_DOC,'A summary for your therapist','Turn a chat into a one-page summary to print or bring to your own therapist.','')],
 methods=['Gottman Method','Emotionally Focused Therapy','CBT for couples','Nonviolent Communication','Imago dialogue','Solution-focused work','Narrative work','Acceptance and commitment','Attachment theory'],
 steps=[('It asks','<div class="fm-b me">He went quiet again after I asked about the trip.</div><div class="fm-b ai">What usually happens in the minutes after that?</div>'),
        ('It names the pattern','<div class="fm-mem">Pattern &middot; you ask, he withdraws, you ask again</div><div class="fm-note"><small>Plain name</small>The chase and retreat cycle</div>'),
        ('It builds a plan','<div class="fm-note"><small>Try this</small>Ask for a time, not an answer: &ldquo;Can we talk Sunday at 8?&rdquo;</div><div class="fm-note alt"><small>In 2 days</small>It checks how it went</div>')])
X['message']=dict(
 sub='Paste a message before you send it. See how it will land, which exact words could backfire, and get versions you can send as they are.',
 goalh='The goal: stop a text from starting a fight you did not mean to start.',
 goal='Short messages lose their tone. &ldquo;Fine. Do whatever you want.&rdquo; can read as cold or as hurt, and the other person will pick one. Message check shows how a draft may read, points at the risky words, and gives you versions that say what you actually mean.',
 capsh='Everything Message check does',
 caps=[(I_EYE,'Tells you how it will land','A plain-language read of how your message is likely to come across, with a risk level: low, medium or high.',''),
  (I_QUOTE,'Points at the exact words','Quotes the phrases in your draft that could backfire, with a short reason for each.',''),
  (I_SPARK,'Versions you can send as they are','Calmer, warmer or more direct, in your own voice and language. It keeps your point and drops the blame.',''),
  (I_CHAT,'Add context if you want','Include what they wrote first, or some background, for a read that fits the situation.',''),
  (I_LOCK,'What you paste is not stored','Only a usage counter is kept. The text of your draft is not saved.',''),
  (I_PEOPLE,'Tailored to your partner','Uses your partner profile, memory and Playbook, with more rewrites on our most advanced model.','Premium')],
 steps=[('Paste your draft','<div class="fm-b me">Fine. Do whatever you want.</div><div class="fm-note alt"><small>Optional context</small>They booked the trip without asking me.</div>'),
        ('See the read','<div class="fm-note pk"><small>Risk: high</small>Reads as cold. &ldquo;Whatever you want&rdquo; invites a fight.</div>'),
        ('Pick a version','<div class="fm-note"><small>Calmer</small>I&rsquo;m upset you decided without me. Can we talk tonight?</div>')])
for f in FEATS: f.update(X[f['id']])

# ---- illustrations for each capability (small drawn UI pieces shown beside the text)
def B(t,k='me'): return '<div class="u-b %s">%s</div>'%(k,t)
def CD(label,text,cls=''): return '<div class="u-c %s"><small>%s</small>%s</div>'%(cls,label,text)
def TG(*t,hot=()):
    return '<div class="u-tags">'+''.join('<b class="%s">%s</b>'%('hot' if x in hot else '',x) for x in t)+'</div>'
def AV(letter,name,sub=''): return '<div class="u-av"><i>%s</i><div><b>%s</b><span>%s</span></div></div>'%(letter,name,sub)
def GAUGE(n,label='readiness'):
    d=157*n/10
    return ('<div class="u-gauge"><svg viewBox="0 0 120 70"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="12" stroke-linecap="round"/>'
            '<path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-dasharray="%.0f 200"/></svg><b>%d<em>/10</em></b><span>%s</span></div>')%(d,n,label)
def LINE(pts):
    xs=[10+i*(100/(len(pts)-1)) for i in range(len(pts))]
    ys=[60-p*5 for p in pts]
    poly=' '.join('%.0f,%.0f'%(x,y) for x,y in zip(xs,ys))
    dots=''.join('<circle cx="%.0f" cy="%.0f" r="4.5" fill="#fffaf2" stroke="#3b2218" stroke-width="2.4"/>'%(x,y) for x,y in zip(xs,ys))
    return '<div class="u-line"><svg viewBox="0 0 120 70"><polyline points="%s" fill="none" stroke="#3b2218" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>%s</svg><span>Readiness across 3 rehearsals</span></div>'%(poly,dots)
CYCLE=('<div class="u-cycle"><svg viewBox="0 0 160 120"><path d="M30 60a50 36 0 0 1 100 0" fill="none" stroke="#3b2218" stroke-width="3" stroke-linecap="round"/><path d="M130 60a50 36 0 0 1-100 0" fill="none" stroke="#3b2218" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>'
 '<path d="M124 52l8 8 4-10z" fill="#3b2218"/><path d="M36 68l-8-8-4 10z" fill="#3b2218"/></svg><b class="t">You ask</b><b class="bt">They withdraw</b></div>')
MIC='<div class="u-mic"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'
SHOT='<div class="u-shot"><i></i><i></i><i class="s"></i><i></i><i class="s"></i></div>'
DOC='<div class="u-doc"><b>Summary for your therapist</b><i></i><i class="s"></i><i></i><i class="s"></i><i></i></div>'
CAL='<div class="u-cal"><div class="d"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b class="on">S</b></div><div class="ev"><b>Sunday, 8 PM</b><span>20 minutes &middot; one topic &middot; one small step</span></div></div>'

# ---- v94 richer examples: a small app card plus overlapping satellite cards (static; only page colours)
def AP(title,sub,body,av='A',tag=''):
    return ('<div class="ap"><div class="ap-h"><i>%s</i><div><b>%s</b><span>%s</span></div>%s</div><div class="ap-b">%s</div></div>'
            %(av,title,sub,('<em class="ap-tag">%s</em>'%tag) if tag else '',body))
def SAT(html,pos='s1',cls=''): return '<div class="sat %s %s">%s</div>'%(pos,cls,html)
def M(t,k='me'): return '<div class="ap-m %s">%s</div>'%(k,t)
def ROW(label,text,cls=''): return '<div class="ap-r %s"><small>%s</small><span>%s</span></div>'%(cls,label,text)
def CHK(t,on=True): return '<div class="ap-k %s"><i></i><span>%s</span></div>'%('on' if on else '',t)
def PILLS(*t,on=()): return '<div class="ap-p">'+''.join('<b class="%s">%s</b>'%('on' if x in on else '',x) for x in t)+'</div>'
def GA(n,label):
    d=157*n/10
    return ('<div class="ap-g"><svg viewBox="0 0 120 70"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="12" stroke-linecap="round"/>'
            '<path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-dasharray="%.0f 200"/></svg><b>%d<em>/10</em></b><span>%s</span></div>')%(d,n,label)
def CH(pts,labels):
    xs=[14+i*(92/(len(pts)-1)) for i in range(len(pts))]; ys=[64-p*5.4 for p in pts]
    area='M%s L%.0f,70 L%.0f,70 Z'%(' L'.join('%.0f,%.0f'%(x,y) for x,y in zip(xs,ys)),xs[-1],xs[0])
    line=' '.join('%.0f,%.0f'%(x,y) for x,y in zip(xs,ys))
    dots=''.join('<circle cx="%.0f" cy="%.0f" r="4.2" fill="#fffaf2" stroke="#3b2218" stroke-width="2.4"/>'%(x,y) for x,y in zip(xs,ys))
    lab=''.join('<span>%s</span>'%l for l in labels)
    return '<div class="ap-c"><svg viewBox="0 0 120 74"><path d="%s" fill="#f7d99a" opacity=".7"/><polyline points="%s" fill="none" stroke="#3b2218" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>%s</svg><div class="ap-cl">%s</div></div>'%(area,line,dots,lab)
CYC=('<svg class="ap-cy" viewBox="0 0 160 118"><g transform="translate(0,10)"><path d="M28 48a52 30 0 0 1 104 0" fill="none" stroke="#3b2218" stroke-width="3" stroke-linecap="round"/><path d="M132 48a52 30 0 0 1-104 0" fill="none" stroke="#3b2218" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/><path d="M126 40l8 8 4-10z" fill="#3b2218"/><path d="M34 56l-8-8-4 10z" fill="#3b2218"/></g>'
     '<text x="80" y="9" text-anchor="middle" font-size="9" font-weight="800" fill="#3b2218">YOU ASK</text><text x="80" y="115" text-anchor="middle" font-size="9" font-weight="800" fill="#3b2218">THEY WITHDRAW</text></svg>')
IMG_BELL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></svg>'
IMG_LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
IMG_MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>'
IMG_FLAME='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2-.5-3 .5-5 1-8z"/></svg>'
IMG_BOLT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 13h6l-1 8 8-10h-6z"/></svg>'
IMG_IMG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>'
IMG_DOC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>'
IMG_MSG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'
BARS=lambda *w: '<div class="ap-bars">'+''.join('<i style="width:%d%%"></i>'%x for x in w)+'</div>'
ART={
 'practice':[
  (AP('Rehearsal with Alex','Playing Alex, in character',M('I felt hurt when you cancelled again.')+M('Here we go. I have been swamped, okay?','ai')+M('I am not blaming you. I just miss us.')+M('...I know. I am sorry. Thursday?','ai'),'A','Live'),
   SAT('<small>Profile</small><b>Alex, partner</b><span>Gets defensive when criticised</span>'+PILLS('Needs time','Avoids conflict'),'s2'),''),
  (AP('Alex, as learned','From 6 of your chats',ROW('Under stress','Goes quiet, withdraws')+ROW('Needs','A calm, soft start')+ROW('Reacts badly to','Being rushed or listed at'),'A','Learned'),
   SAT('<small>From Coach Chat</small><span>&ldquo;He went quiet again after I asked about the trip.&rdquo;</span>','s1'),''),
  (AP('Alex&rsquo;s real words','Pasted from your phone',M('ok. whatever works for u.','ai')+M('fine. dont wait up','ai')+'<div class="ap-sep">Rehearses in this voice</div>'+M('ok. i guess we can do thursday.','ai'),'A','3 messages'),
   SAT('<small>Voice matched</small><span>Short, lowercase, dry</span>','s2'),''),
  (AP('Your debrief','After your rehearsal',ROW('Went well','You started with a feeling, not blame.','y')+ROW('Watch for','You slipped into &ldquo;always&rdquo; once.')+ROW('Try next','Add what you can offer too.','pk'),'&#10003;'),
   SAT(GA(8,'Readiness'),'s1','gs'),''),
  (AP('Readiness','Rehearsals with Alex',GA(8,'Ready to talk')+'<div class="ap-s2"><b>5</b><i></i><b>7</b><i></i><b class="on">8</b></div>','&#9733;'),
   SAT('<small>Since your first try</small><b>+3</b>','s1'),''),
  (AP('Your talk plan','Linked to your rehearsal',ROW('Opening line','&ldquo;I miss us. Can we talk tonight?&rdquo;','y')+ROW('Avoid','&ldquo;always&rdquo;, &ldquo;never&rdquo;, raising old fights')+ROW('If it heats up','Pause. Name the feeling. Return in ten minutes.'),'&#9998;','Premium'),
   SAT(CHK('Pick a calm time'),'s2'),''),
  (AP('Difficulty','Hard mode',PILLS('Calm','Defensive','Cold','Angry',on=('Defensive',))+M('You always do this!','ai')+M('I hear you. Can we slow down?'),IMG_FLAME,'Premium'),
   SAT('<small>Alex now</small><b>Defensive</b><span>pushes back, shuts down</span>','s1'),''),
  (AP('Progress with Alex','Last 3 rehearsals',CH([4,6,8],['Mon','Wed','Fri']),'&#8599;','Premium'),
   SAT('<small>Readiness</small><b>4 &rarr; 8</b>','s1'),''),
  (AP('Who are you practising with?','Save as many as you need','<div class="ap-l"><i>A</i><b>Alex</b><span>Partner</span></div><div class="ap-l"><i>M</i><b>Mum</b><span>Parent</span></div><div class="ap-l"><i>B</i><b>Ben</b><span>Boss</span></div><div class="ap-l"><i>J</i><b>Jamie</b><span>Ex</span></div>','+','Pro'),
   SAT('<small>Any language</small><span>English, Deutsch, Slovensky&hellip;</span>','s2'),''),
 ],
 'coach':[
  (AP('Coach','Asks before it advises',M('He went quiet again after I asked about the trip.')+M('That sounds frustrating. Two quick questions first.','ai')+M('1. What usually happens in the minutes after?<br>2. What do you do next?','ai'),'C'),
   SAT('<small>Question 1 of 2</small><span>So the advice fits you, not a generic couple.</span>','s2'),''),
  (AP('Pattern spotted','Seen in 4 of your chats',CYC+'<div class="ap-nm"><small>Plain name</small>The chase and retreat cycle</div>','&#8635;'),
   SAT('<small>Next time</small><span>You will see it as it starts.</span>','s1'),''),
  (AP('What I remember','About you and your partner','<div class="ap-mm"><i></i>Works late on Tuesdays</div><div class="ap-mm"><i></i>Withdraws when stressed</div><div class="ap-mm"><i></i>Likes a clear plan</div><div class="ap-mm"><i></i>Last fight: the trip</div>','&#9825;'),
   SAT('<small>No starting from zero</small><span>Memory carries across every chat.</span>','s2'),''),
  (AP('Both sides','An honest read','<div class="ap-two"><div>'+ROW('Your view','I just wanted an answer.')+'</div><div>'+ROW('Their view','I felt pushed.')+'</div></div>'+ROW('Your share','Asking three times in a row.','y'),'&#9878;'),
   SAT('<small>Honest, not harsh</small><span>It does not just agree with you.</span>','s2'),''),
  (AP('Blended for you','Real couples methods','<div class="ap-me"><b>Gottman</b><span>Start softly, repair early</span></div><div class="ap-me"><b>EFT</b><span>The need under the anger</span></div><div class="ap-me"><b>NVC</b><span>Say it without blame</span></div><div class="ap-me"><b>Attachment</b><span>Why you each react</span></div>','&#9733;'),
   SAT(PILLS('CBT','Imago','Narrative','ACT'),'s2','sp'),''),
  (AP('Your plan','This week',CHK('Weekly check-in, Sunday 8 PM')+CHK('Time-out agreement',False)+CHK('10-minute listening exercise',False),'&#10003;'),
   SAT('<small>Sunday</small><b>8:00 PM</b><span>20 minutes, one topic</span>','s1'),''),
  (AP('Try this','Saved as an experiment','<div class="ap-try">Ask for a time, not an answer: &ldquo;Can we talk Sunday at 8?&rdquo;</div><div class="ap-fu">'+IMG_BELL+'Two days later: how did it go?</div>'+PILLS('Worked','Did not help','Did not get to it',on=('Worked',)),IMG_BOLT),
   SAT('<small>Next step</small><span>It adjusts to what happened.</span>','s2'),''),
  (AP('Photo and voice','Add the real conversation','<div class="ap-shot"><i></i><i class="r"></i><i></i><i class="r"></i></div><div class="ap-voice">'+IMG_MIC+'<span>&ldquo;He just said fine and left...&rdquo;</span></div>',IMG_IMG),
   SAT('<small>Replies in your language</small><span>Dictate in any language.</span>','s2'),''),
  (AP('Summary for your therapist','One page, from your chat','<div class="ap-doc"><h5>What is going on</h5>'+BARS(92,70)+'<h5>Patterns</h5>'+BARS(88,60)+'<h5>What you tried</h5>'+BARS(80,46)+'</div>',IMG_DOC),
   SAT('<small>Print or save</small><b>PDF</b>','s1'),''),
 ],
 'message':[
  (AP('Message check','Before you send','<div class="ap-draft">Fine. Do whatever you want.</div><div class="ap-risk"><span>Risk</span><i><b></b></i><em>High</em></div>'+ROW('Reads as','Cold and closed-off. Likely to start a fight.','pk'),IMG_MSG),
   SAT('<small>Likely reaction</small><span>&ldquo;What did I do now?&rdquo;</span>','s2'),''),
  (AP('Risky words','Quoted from your draft','<div class="ap-draft">&ldquo;Fine. Do <mark>whatever you want</mark>. You <mark>always</mark> do this.&rdquo;</div>'+ROW('whatever you want','Sounds like giving up','pk')+ROW('always','Blames, invites defending'),'!'),
   SAT('<small>2 flags</small><span>With a reason for each</span>','s1'),''),
  (AP('Pick a version','Keeps your point, drops the blame','<div class="ap-v"><small>Calmer</small>I am upset you decided without me. Can we talk tonight?</div><div class="ap-v w"><small>Warmer</small>I felt left out. I would love to be part of the plan.</div><div class="ap-v d"><small>Direct</small>Next time, ask me before you book.</div>','&#10022;'),
   SAT('<small>Your voice</small><span>Same language you write in</span>','s1'),''),
  (AP('Add context','Optional','<div class="ap-m ai">Booked the trip for May 12. You are free, right?</div><div class="ap-m me">Fine. Do whatever you want.</div>'+ROW('Background','They booked it without asking me.','y'),'&#9998;'),
   SAT('<small>Better read</small><span>It fits your situation.</span>','s2'),''),
  (AP('Privacy','What happens to your draft','<div class="ap-pv"><span class="no">Not stored</span>The text you paste</div><div class="ap-pv"><span>Kept</span>A usage counter only</div>'+IMG_LOCK.replace('<svg','<svg class="ap-lk"'),IMG_LOCK),
   SAT('<small>Drafts saved</small><b>0</b>','s1'),''),
  (AP('Tailored to Sam','Premium','<div class="ap-v"><small>Generic</small>I felt left out. Can we talk?</div><div class="ap-v w"><small>For Sam, who goes quiet when criticised</small>I would love to pick the dates together. No rush, tell me what works.</div>','S','Premium'),
   SAT('<small>Uses</small><span>Profile, memory, Playbook</span>','s2'),''),
 ],
}
HEART_ICON='<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.8 4.5 6.2 4.5c2.1 0 3.7 1.2 4.6 2.7.4.6 1.4.6 1.8 0 .9-1.5 2.5-2.7 4.6-2.7 3.4 0 5.3 3.5 3.8 7.1C19.5 16.4 12 21 12 21z"/></svg>'
FLOATS='<div class="fl" aria-hidden="true">'+''.join('<span class="f%d">%s</span>'%(k,HEART_ICON) for k in range(1,8))+'</div>'

# ---- drawn illustrations for the "How X helps you" trio (page colours only)
_K,_G,_P,_C,_B,_W='#3b2218','#f7d99a','#f4b8c4','#f8c7a3','#b78d74','#fffaf2'
def _h(x,y,sc,fill,extra=''): return '<path d="%s" transform="translate(%s %s) scale(%s)" fill="%s" %s/>'%(HEART,x,y,sc,fill,extra)
_SP='M0-10 C1-3 3-1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3-1 -1-3 0-10Z'
def _sp(x,y,sc,fill): return '<path d="%s" transform="translate(%s %s) scale(%s)" fill="%s"/>'%(_SP,x,y,sc,fill)
def _svg(b): return '<svg class="pg-art" viewBox="0 0 200 160" aria-hidden="true">%s</svg>'%b
ILL={
 'a1':_svg('<rect x="70" y="20" width="100" height="68" rx="28" fill="%s"/><path d="M146 84 L162 108 L132 90Z" fill="%s"/>'%(_K,_K)+_sp(120,54,1.6,_W)+_sp(148,38,.8,_G)
      +'<rect x="22" y="52" width="104" height="72" rx="30" fill="%s"/><path d="M54 118 L40 144 L74 122Z" fill="%s"/>'%(_P,_P)+_h(48,66,.58,_K)+'<circle cx="104" cy="92" r="4" fill="%s"/><circle cx="116" cy="92" r="4" fill="%s" opacity=".5"/>'%(_K,_K)),
 'a2':_svg('<rect x="58" y="34" width="100" height="116" rx="14" fill="%s"/><rect x="48" y="24" width="100" height="116" rx="14" fill="%s" stroke="%s" stroke-width="3"/><path d="M48 38a14 14 0 0 1 14-14h72a14 14 0 0 1 14 14v10H48z" fill="%s"/>'%(_C,_W,_K,_K)
      +'<rect x="66" y="68" width="62" height="9" rx="4.5" fill="%s"/><rect x="66" y="86" width="48" height="9" rx="4.5" fill="%s"/><rect x="66" y="104" width="56" height="9" rx="4.5" fill="%s"/>'%(_C,_C,_C)
      +'<circle cx="136" cy="116" r="22" fill="%s" stroke="%s" stroke-width="3"/><path d="M125 116 l8 8 14-16" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'%(_G,_K,_K)+_h(34,18,.3,_P)),
 'a3':_svg('<path d="M100 20 q-30 20 -30 60 q0 40 30 60" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" opacity=".35"/><path d="M100 20 q30 20 30 60 q0 40 -30 60" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" opacity=".35"/>'%(_K,_K)
      +'<path d="M100 28 q-46 28 -46 52 q0 34 46 52" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" opacity=".18"/><path d="M100 28 q46 28 46 52 q0 34 -46 52" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" opacity=".18"/>'%(_K,_K)
      +_h(48,34,1.04,_P)+_h(108,22,.5,_G,'stroke="%s" stroke-width="3"'%_K)+_sp(46,40,1,_G)+_sp(160,110,1.2,_C)),
 'm1':_svg('<rect x="26" y="28" width="148" height="96" rx="34" fill="%s"/><path d="M60 118 L44 148 L84 124Z" fill="%s"/>'%(_G,_G)
      +'<path d="M54 76 q46 -44 92 0 q-46 44 -92 0z" fill="%s" stroke="%s" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="76" r="17" fill="%s"/><circle cx="100" cy="76" r="7" fill="%s"/><circle cx="106" cy="70" r="3.5" fill="%s"/>'%(_W,_K,_P,_K,_W)
      +'<path d="M78 42 l-6 -12 M100 36 v-14 M122 42 l6 -12" stroke="%s" stroke-width="4" stroke-linecap="round"/>'%_K),
 'm2':_svg('<rect x="22" y="14" width="112" height="40" rx="18" fill="%s"/><rect x="38" y="62" width="130" height="40" rx="18" fill="%s"/><rect x="22" y="110" width="104" height="40" rx="18" fill="%s"/>'%(_G,_P,_C)
      +'<rect x="38" y="28" width="60" height="7" rx="3.5" fill="%s"/><rect x="54" y="76" width="82" height="7" rx="3.5" fill="%s"/><rect x="54" y="88" width="48" height="7" rx="3.5" fill="%s"/><rect x="38" y="124" width="66" height="7" rx="3.5" fill="%s"/>'%(_K,_K,_K,_K)
      +_h(142,16,.3,_K)+_sp(176,50,1,_G)+_sp(150,138,.8,_P)),
 'm3':_svg('<rect x="24" y="22" width="116" height="82" rx="28" fill="%s" stroke="%s" stroke-width="3"/><path d="M52 100 L42 126 L76 104Z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/><rect x="46" y="48" width="72" height="8" rx="4" fill="%s"/><rect x="46" y="66" width="48" height="8" rx="4" fill="%s"/>'%(_W,_K,_W,_K,_C,_C)
      +'<circle cx="148" cy="108" r="30" fill="%s" stroke="%s" stroke-width="3"/><path d="M148 122 V96 M136 107 l12 -12 12 12" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'%(_P,_K,_K)+_h(120,14,.36,_P,'stroke="%s" stroke-width="3"'%_K)+_sp(176,50,1.1,_G)),
 'c1':_svg('<path d="M100 40 C80 28 50 28 28 38 V130 C50 120 80 120 100 132 Z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/><path d="M100 40 C120 28 150 28 172 38 V130 C150 120 120 120 100 132 Z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'%(_W,_K,_C,_K)
      +_h(46,52,.5,_P)+'<rect x="116" y="56" width="42" height="7" rx="3.5" fill="%s"/><rect x="116" y="72" width="34" height="7" rx="3.5" fill="%s"/><rect x="116" y="88" width="40" height="7" rx="3.5" fill="%s"/>'%(_K,_K,_K)
      +'<path d="M132 28 v34 l9 -8 9 8 v-34z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'%(_G,_K)+_sp(22,24,1,_G)+_sp(178,126,.9,_P)),
 'c2':_svg('<circle cx="100" cy="80" r="52" fill="%s" opacity=".55"/><path d="M52 80 a48 48 0 0 1 82 -34" fill="none" stroke="%s" stroke-width="6" stroke-linecap="round"/><path d="M148 80 a48 48 0 0 1 -82 34" fill="none" stroke="%s" stroke-width="6" stroke-linecap="round"/><path d="M132 28 l10 20 -22 4z" fill="%s"/><path d="M68 132 l-10 -20 22 -4z" fill="%s"/>'%(_G,_K,_K,_K,_K)
      +_h(76,58,.48,_P,'stroke="%s" stroke-width="3"'%_K)+'<circle cx="34" cy="48" r="6" fill="%s"/><circle cx="170" cy="118" r="6" fill="%s"/>'%(_P,_C)),
 'c3':_svg('<path d="M12 142 q30 -8 60 0 t60 0 t56 0" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/><rect x="92" y="18" width="10" height="126" rx="5" fill="%s" stroke="%s" stroke-width="3"/>'%(_K,_B,_K)
      +'<path d="M96 30 H40 l-14 14 14 14 H96z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/><path d="M100 70 H152 l16 14 -16 14 H100z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'%(_P,_K,_K,_K)
      +_h(44,34,.2,_W)+_h(126,74,.2,_W)+_sp(162,34,1,_G)+_sp(30,112,.8,_C)),
}
ILLMAP={'practice':['a1','a2','a3'],'message':['m1','m2','m3'],'coach':['c1','c2','c3']}
HELPH={'practice':('How Partner Practice helps you walk in ready','Hard conversations rarely get a second try. Here you get the first one for free, so the real one goes better.'),
 'message':('How Message check helps you send what you mean','Short messages lose their tone. See how yours will land before the other person does.'),
 'coach':('How Coach Chat helps you see clearly','It asks, remembers, names what keeps repeating, and ends with one small thing to do next.')}
def _panel(i,f):
    nxt=FEATS[(i+1)%len(FEATS)]
    art=ART[f['id']]
    btns='';exs='';caps=''
    for n,c in enumerate(f['caps']):
        plan=('<em class="fm-plan">%s</em>'%c[3]) if c[3] else ''
        on=' on' if n==0 else ''
        btns+=('<button type="button" class="tb-b%s" role="tab" aria-selected="%s" data-i="%d"><span class="tb-i">%s</span><span class="tb-t"><b>%s%s</b><span class="tb-d"><span>%s</span></span></span></button>'
               %(on,'true' if n==0 else 'false',n,c[0],c[1],plan,c[2]))
        exs+='<div class="tb-ex%s" data-i="%d"><div class="ex">%s</div></div>'%(on,n,art[n][0]+art[n][1])
        caps+='<div class="tb-cap%s" data-i="%d"><h4>%s%s</h4><p>%s</p></div>'%(on,n,c[1],plan,c[2])
    tri=''.join('<div class="pg-i">%s<h4>%s</h4><p>%s</p></div>'%(ILL[ILLMAP[f['id']][k]],h[1],h[2]) for k,h in enumerate(f['helps']))
    meth=('<div class="fm-meth"><b>Draws on</b>'+''.join('<span>%s</span>'%m for m in f['methods'])+'</div>') if f.get('methods') else ''
    good=''.join('<li>%s</li>'%g for g in f['good'])
    return ('<article class="fm-panel pg" id="learn-%s" data-f="%s" hidden style="--tint:%s">'
     '<div class="pg-hero">'+FLOATS+'<span class="fm-kick"><b>%s</b><span>%s</span></span><h2 id="fm-title-%s">%s</h2><p class="fm-sub">%s</p>'
     '<div class="fm-cta"><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-feature-%s">Get early access</a><span class="hx-free">Free to try</span></div>'
     '</div>'
     '<section class="pg-sec pg-help"><h3>%s</h3><p class="pg-lead">%s</p><div class="pg-3">%s</div></section>'
     '<section class="pg-sec pg-tabs"><h3>%s</h3><div class="tbx"><div class="tb-list" role="tablist">%s</div><div class="tb-stage" data-i="0"><span class="dc d1"></span><span class="dc d2"></span><span class="dc d3"></span>%s</div><div class="tb-caps">%s</div></div>%s</section>'
     '<section class="pg-sec pg-good"><h3>Good for</h3><ul class="fm-good">%s</ul></section>'
     '<div class="pg-end">'+FLOATS+'<h3>%s</h3><div class="fm-cta"><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-feature-end-%s">Get early access</a></div><div class="fm-avail"><b>What you get</b><span>%s</span></div></div>'
     '<div class="fm-foot"><p>Not a replacement for therapy. If you are in a crisis, please contact a professional or a helpline in your country.</p>'
     '<button type="button" class="fm-next" data-go="%s">Next: %s <span aria-hidden="true">&rarr;</span></button></div>'
     '</article>')%(f['id'],f['id'],f['tint'],f['tag'],f['when'],f['id'],f['h'],f['sub'],f['id'],HELPH[f['id']][0],HELPH[f['id']][1],tri,f['capsh'],btns,exs,caps,meth,good,PGEND[f['id']][0],f['id'],f['avail'],nxt['id'],nxt['tag'])
PGEND={'practice':('Have the talk twice. Once here, once for real.','Rehearse with an AI that answers like your partner, get honest feedback, and walk in ready.'),
 'coach':('Someone to think it through with, any hour.','Honest, remembers your story, and always ends with one small next step.'),
 'message':('Know how it lands before you hit send.','Paste a draft, see the risk, and send the version you actually mean.')}

# ---- "Other tools" window (the nine smaller tools, simpler than the flagship windows)
def MN(title,body,tag=''): return '<div class="mn"><div class="mn-h"><b>%s</b>%s</div>%s</div>'%(title,('<em>%s</em>'%tag) if tag else '',body)
_cal='<div class="mn-cal">'+''.join('<i class="%s"></i>'%c for c in ['','f','','f','f','','','f','','','f','p','f','','','f','f','','p','f','','','f','','f','f','p',''])+'</div>'
_ICO=lambda d:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>'%d
MORE=[
 ('After a fight','Free','A short calming guide for the first hour. Pro adds a message to reach out.',
  MN('The first hour',CHK('Breathe slowly')+CHK('Step away for a while',False)+CHK('Reach out when calm',False))),
 ('Playbook','Free','One small thing to try. See what really works for you.',
  MN('Try this','<div class="ap-try">Ask for a time, not an answer.</div>'+PILLS('Worked','Did not help',on=('Worked',)))),
 ('Daily check-in and question','Free','One private minute a day.',
  MN('Today','<div class="mn-moods"><i></i><i></i><i class="on"></i><i></i><i></i></div><div class="ap-r y"><small>Question of the day</small><span>What made you feel close this week?</span></div>')),
 ('Share with your partner','Free','Share what you choose. No account needed.',
  MN('Share','<div class="mn-link">'+_ICO('<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>')+'<span>relationshipaiadvice.com/s/&hellip;</span></div>'+PILLS('You choose what','No account needed'))),
 ('Therapist summary','Free','A one-page summary of a chat, to download or print.',
  '<div class="mn mn-doc"><h5>Summary for your therapist</h5>'+BARS(92,70)+'<h5>Patterns</h5>'+BARS(86,52)+'</div>'),
 ('Weekly focus and ideas','Pro','One focus a week, plus ideas for gestures and dates.',
  MN('This week','<div class="ap-r pk"><small>Focus</small><span>Listen first, answer second</span></div>'+PILLS('A small gesture','A date idea'))),
 ('Insights','Pro','Patterns the coach notices, in a weekly summary.',
  MN('Across your chats',CH([3,5,4,7,8],['Mon','Wed','Fri','Sat','Sun'])+'<div class="ap-mm"><i></i>You calm down faster</div>')),
 ('Talk plan and hard mode','Premium','An opening line, what to avoid, and a hard mode.',
  MN('Talk plan',ROW('Opening line','&ldquo;I miss us. Can we talk tonight?&rdquo;','y')+PILLS('Calm','Defensive','Cold',on=('Defensive',)))),
 ('Monthly review and your year','Premium','A calm look back at your month and year.',
  MN('Your month',_cal+'<div class="mn-leg"><span><i class="f"></i>Check-ins</span><span><i class="p"></i>Talks</span></div>')),
]

MORE_TXT={
 'After a fight':('A calm-down guide for the first hour after an argument, so you do not make it worse. Pro and Premium also write a short message you can use to reach out.',
   ['Settle your body first, then a few simple rules for the next hour','Pro: a personal message to reach out, 3 a month','Premium: unlimited, tailored to you, with a check-in the next day']),
 'Playbook':('Turns advice into small experiments. When the coach suggests something to try, one tap saves it, and two days later a reminder asks how it went.',
   ['Mark each try: worked, did not help, did not get to it','Reminder by email and push after two days','Premium: an AI read of everything that works for you']),
 'Daily check-in and question':('One private minute a day. Rate how connected you feel, from 1 to 10, and answer one question about your relationship.',
   ['Over 100 questions that do not repeat, then new ones made for you','Always optional, and it never blocks anything else','A reminder with your own question, by email or push']),
 'Share with your partner':('Share only what you choose. Add specific things one at a time, then send your partner a link they can open without an account.',
   ['Nothing is ever shared automatically','You see everything before it goes out','Turn the link off or delete it any time']),
 'Therapist summary':('Turns a Coach Chat conversation into a one-page summary for your own therapist: what is going on, the recurring themes and points to discuss.',
   ['Print it or save it as a PDF','Made once per chat, regenerate any time','Premium: a printable one-page Therapist pack with your story']),
 'Weekly focus and ideas':('One thing to focus on this week, plus ideas for small gestures and dates, based on what the coach knows about you and your partner.',
   ['Pro: the focus of the week, also in your weekly email, and 3 ideas','Premium: why and when, a recap of last week and 5 tailored ideas','Premium: refresh any time, plus a Monday reminder']),
 'Insights':('Looks across all your Coach Chat conversations, not just one, and names the patterns that keep coming back.',
   ['Patterns named from several chats, in plain words','Connection over time, from your own daily ratings','The coach uses them, so advice builds on what it has seen']),
 'Talk plan and hard mode':('Two extras for Partner Practice. Talk plan prepares the real conversation, and hard mode makes the practice partner push back harder.',
   ['Talk plan: an opening line, what to avoid and how to respond if it heats up','Hard mode: defensive, cold or angry reactions, so the real talk feels easier','Progress across your rehearsals with the same person']),
 'Monthly review and your year':('On the 1st you get a calm look back at last month: what came up, what helped and one small thing to try next. Your year so far zooms out across the whole year.',
   ['Written for you automatically, private to you','Push and email when it is ready','Ends with one small thing to try next']),
}
def _panel_more():
    cards=''.join('<div class="mo-c"><div class="mo-t">%s</div><div class="mo-b"><h3>%s<em class="mo-p %s">%s</em></h3><p>%s</p><ul>%s</ul></div></div>'%(art,t,pl.lower(),pl,MORE_TXT[t][0],''.join('<li>%s</li>'%x for x in MORE_TXT[t][1])) for t,pl,d,art in MORE)
    also=''.join('<span>%s</span>'%x for x in ['Dictate with your voice','Add screenshots and files','Save more than one partner profile','Choose Fast or Advanced AI for each chat'])
    return ('<article class="fm-panel pg mo" id="learn-more" data-f="more" hidden style="--tint:#f7d99a">'
     '<div class="pg-hero">'+FLOATS+'<span class="fm-kick"><b>Other tools</b><span>After the chat ends</span></span><h2 id="fm-title-more">Small tools that help <em>after the chat ends.</em></h2>'
     '<p class="fm-sub">Nine more tools around the three main ones, so the work carries on between conversations.</p>'
     '<div class="fm-cta"><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-feature-more">Get early access</a><span class="hx-free">Free to try</span></div></div>'
     '<section class="pg-sec mo-sec"><div class="mo-grid">'+cards+'</div><div class="mo-also"><b>Also included</b>'+also+'</div></section>'
     '<div class="fm-foot"><p>Not a replacement for therapy. If you are in a crisis, please contact a professional or a helpline in your country.</p>'
     '<button type="button" class="fm-next" data-go="practice">Next: Partner Practice <span aria-hidden="true">&rarr;</span></button></div></article>')

BPOSTS={
 'attachment':('how-attachment-styles-work-in-relationships','2026-10-08','attachment styles','8 Oct 2026 \u00b7 5 min read','Attachment styles in relationships: secure, anxious, avoidant and fearful-avoidant explained','What attachment styles are, how anxious, avoidant, secure and fearful-avoidant attachment show up in dating and texting, and why your attachment style isn\'t fixed.'),
 'apology':('how-to-apologize-to-your-partner','2026-10-08','apologies','8 Oct 2026 \u00b7 4 min read','How to apologize to your partner (and what makes an apology actually work)','How to apologize to your partner in a way that lands. What research on apologies found, a simple structure, real examples and what to avoid when you say sorry.'),
 'overthink':('how-to-stop-overthinking-in-a-relationship','2026-10-08','overthinking','8 Oct 2026 \u00b7 5 min read','How to stop overthinking in a relationship (a calmer way to handle the what-if spiral)','Overthinking in a relationship, like replaying texts or reading into silence, is very common. Here is a practical way to break the loop and talk to your partner.'),
 'habits':('relationship-advice-communication-habits','2026-10-05','communication','5 Oct 2026 \u00b7 3 min read','Relationship advice: 7 communication habits that change how you argue','Practical relationship advice on how to communicate better. Seven small habits, from softer starts to taking breaks, that make hard conversations go better.'),
 'fix':('how-to-fix-a-relationship','2026-10-04','repair','4 Oct 2026 \u00b7 2 min read','How to fix a relationship: where to start when it feels broken','A calm, step-by-step starting point for a relationship that feels distant or stuck, from stopping arguments from escalating to rebuilding closeness.'),
 'problems':('relationship-problems-that-keep-coming-back','2026-10-03','recurring problems','3 Oct 2026 \u00b7 3 min read','5 relationship problems that keep coming back (and what\'s usually underneath)','The same relationship problems show up in almost every couple: chores, time, money, intimacy and the fight that never ends. Here\'s what\'s usually underneath.'),
}
BTOPICS=[
 ('attachment','Attachment styles','Attachment style is the pattern you learned for getting close to people, and how you react when closeness feels uncertain.',['attachment','overthink'],'#f7d99a'),
 ('communication','Communication','How you say something often matters more than what you say. A few small habits change how hard conversations go.',['habits','apology','problems'],'#f4b8c4'),
 ('conflict','Conflict','Every couple argues. What matters is how a fight starts, how it escalates and how you find your way back to each other.',['problems','habits','apology','fix'],'#f8c7a3'),
 ('repair','Repairing a relationship','Repair is what you do when things have gone wrong: slowing down, owning your part and rebuilding trust one small step at a time.',['fix','apology','problems'],'#f7d99a'),
 ('overthinking','Overthinking','Overthinking is the loop of replaying texts, guessing what silence means and imagining the worst. It is common and it can be calmed.',['overthink','attachment'],'#f4b8c4'),
]
BARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
def _panel_blog(i,t):
    key,name,dfn,posts,tint=t
    cards=''
    for n,k in enumerate(posts):
        sl,dt,tag,meta,ti,ds=BPOSTS[k]
        cards+=('<a class="post-card bl-card%s" href="/blog/%s/"%s data-umami-event="blog-topic-%s-%s"><span class="post-thumb"><img src="/img/blog/card-%s.svg?v=1" alt="" width="1200" height="630" loading="lazy"></span>'
          '<div class="post-card-top"><span class="post-tag">%s</span><span class="post-meta">%s</span></div><h3>%s</h3><p>%s</p><span class="post-more">Read article %s</span></a>')%(
          ' bl-x' if n>=3 else '',sl,' hidden' if n>=3 else '',key,sl,sl,tag,meta,ti,ds,BARROW)
    more='<button type="button" class="bl-sm" data-show><span>Show more</span></button>' if len(posts)>3 else ''
    chips=''.join('<a href="#learn-blog-%s" data-feature="blog-%s" class="bl-chip">%s</a>'%(o[0],o[0],o[1]) for o in BTOPICS if o[0]!=key)
    cnt='%d article%s'%(len(posts),'' if len(posts)==1 else 's')
    return ('<article class="fm-panel pg bl" id="learn-blog-%s" data-f="blog-%s" hidden style="--tint:%s">'
     '<div class="pg-hero bl-hero">'%(key,key,tint)+FLOATS+'<nav class="bl-crumb" aria-label="Breadcrumb"><a href="#learn-blog-all" data-feature="blog-all">Articles</a><i>/</i><b>%s</b></nav>'%name+
     '<h2 id="fm-title-blog-%s">%s</h2><p class="fm-sub">%s</p><span class="bl-count">%s</span></div>'%(key,name,dfn,cnt)+
     '<section class="pg-sec bl-sec"><div class="bl-list">'+cards+'</div>'+more+
     '<div class="bl-topics"><b>More topics</b><div>'+chips+'</div></div>'
     '<div class="bl-cta"><div><h3>Want help in the moment?</h3><p>Ask the coach what to say, check a message before you send it or practise a hard talk.</p></div><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-blog-%s">Get early access</a></div></section>'%key+
     '<div class="fm-foot"><p>Articles are for general information and do not replace professional care. If you are in a crisis, please contact a professional or a helpline in your country.</p><a class="fm-next bl-all" href="#learn-blog-all" data-feature="blog-all">All articles <span aria-hidden="true">&rarr;</span></a></div></article>')

SUMAIL='relationshipai.advice@gmail.com'
def _su_ico(d): return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>'%d
SU_ENV=_su_ico('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>')
SU_IG=_su_ico('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>')
def _panel_support():
    big=('<div class="su-big">'
     '<div class="su-c su-mail"><div class="su-t"><span class="su-ic">'+SU_ENV+'</span></div><div class="su-b"><h3>Email us</h3><p>The best way to reach us for anything: questions, bugs, feedback or ideas.</p>'
     '<a class="su-addr" href="mailto:'+SUMAIL+'" data-umami-event="support-email">'+SUMAIL+'</a>'
     '<a class="hx-btn" href="mailto:'+SUMAIL+'?subject=Hello%20RelationshipAI" data-umami-event="support-email-btn">Write an email</a></div></div>'
     '<div class="su-c su-ig"><div class="su-t"><span class="su-ic">'+SU_IG+'</span></div><div class="su-b"><h3>Message us on Instagram</h3><p>Prefer a quick chat? Send us a DM or leave a comment and we will reply there.</p>'
     '<a class="su-addr" href="https://www.instagram.com/relationshipai_/" target="_blank" rel="noopener noreferrer" data-umami-event="support-ig">@relationshipai_</a>'
     '<a class="hx-btn ghost" href="https://ig.me/m/relationshipai_" target="_blank" rel="noopener noreferrer" data-umami-event="support-ig-btn">Send a DM <span aria-hidden="true">&rarr;</span></a></div></div></div>')
    return ('<article class="fm-panel pg su" id="learn-support" data-f="support" hidden style="--tint:#f4b8c4">'
     '<div class="pg-hero">'+FLOATS+'<span class="fm-kick"><b>Support</b><span>We read every message</span></span><h2 id="fm-title-support">We would love to <em>hear from you.</em></h2>'
     '<p class="fm-sub">Questions, feedback, a bug or something that did not feel right. Write to us by email or on Instagram and we will get back to you.</p>'
     '<div class="fm-cta"><a href="mailto:'+SUMAIL+'" class="hx-btn" data-umami-event="cta-support-hero">Email us</a><span class="hx-free">or message us on Instagram</span></div></div>'
     '<section class="pg-sec su-sec"><h3 class="su-h">Get in touch</h3>'+big+
     '<div class="su-note"><div><h3>Looking for a quick answer?</h3><p>Many common questions are already answered in our FAQ.</p></div>'
     '<a href="#faq" class="hx-btn ghost" data-fclose data-umami-event="support-faq">Read the FAQ <span aria-hidden="true">&rarr;</span></a></div></section>'
     '<div class="fm-foot"><p>RelationshipAI cannot help in an emergency. If you are in a crisis, please contact a professional or a helpline in your country.</p>'
     '</div></article>')


def _post_topics(k): return ' '.join(t[0] for t in BTOPICS if k in t[3])
def _panel_blog_all():
    cards=''
    for k,(sl,dt,tag,meta,ti,ds) in BPOSTS.items():
        cards+=('<a class="post-card bl-card" href="/blog/%s/" data-t="%s" data-umami-event="blog-all-%s"><span class="post-thumb"><img src="/img/blog/card-%s.svg?v=1" alt="" width="1200" height="630" loading="lazy"></span>'
          '<div class="post-card-top"><span class="post-tag">%s</span><span class="post-meta">%s</span></div><h3>%s</h3><p>%s</p><span class="post-more">Read article %s</span></a>')%(sl,_post_topics(k),sl,sl,tag,meta,ti,ds,BARROW)
    chips='<button type="button" class="bl-fl on" data-t="all" aria-pressed="true">All</button>'+''.join('<button type="button" class="bl-fl" data-t="%s" aria-pressed="false">%s</button>'%(t[0],t[1]) for t in BTOPICS)
    return ('<article class="fm-panel pg bl" id="learn-blog-all" data-f="blog-all" hidden style="--tint:#f7d99a">'
     '<div class="pg-hero bl-hero">'+FLOATS+'<nav class="bl-crumb" aria-label="Breadcrumb"><b>Articles</b></nav>'
     '<h2 id="fm-title-blog-all">All articles</h2><p class="fm-sub">Practical guides on communication, conflict and connection. Pick a topic to see only those articles.</p><span class="bl-count">%d articles</span></div>'%len(BPOSTS)+
     '<section class="pg-sec bl-sec"><div class="bl-filters" role="group" aria-label="Filter by topic">'+chips+'</div>'
     '<div class="bl-list">'+cards+'</div>'
     '<div class="bl-cta"><div><h3>Want help in the moment?</h3><p>Ask the coach what to say, check a message before you send it or practise a hard talk.</p></div><a href="#join" class="hx-btn" data-fclose data-umami-event="cta-blog-all">Get early access</a></div></section>'
     '<div class="fm-foot"><p>Articles are for general information and do not replace professional care. If you are in a crisis, please contact a professional or a helpline in your country.</p></div></article>')
FM_HTML=('<div class="fm" id="feature" role="dialog" aria-modal="true" aria-label="Feature details" hidden>'
 '<div class="about-backdrop" data-fclose></div><div class="fm-scroll"><div class="fm-wrap">'+WINBG+_wnav('data-fclose')+
 '<div class="fm-card">'+''.join(_wrapbody(_panel(i,f)) for i,f in enumerate(FEATS))+_wrapbody(_panel_more())+_wrapbody(_panel_support())+''.join(_wrapbody(_panel_blog(i,t)) for i,t in enumerate(BTOPICS))+_wrapbody(_panel_blog_all())+FSITE+'</div></div></div></div>')
FM_JS = """<script>(function(){var m=document.getElementById('feature');if(!m)return;var P=[].slice.call(m.querySelectorAll('.fm-panel')),last=null,cur=null;
function show(id){P.forEach(function(p){p.hidden=p.dataset.f!==id;[].forEach.call(p.querySelectorAll('.bl-x'),function(x){x.hidden=true});var b=p.querySelector('.bl-sm');if(b)b.hidden=false});if(id==='blog-all'){var ap=m.querySelector('.fm-panel[data-f=blog-all]');if(ap){[].forEach.call(ap.querySelectorAll('.bl-fl'),function(b){var on=b.getAttribute('data-t')==='all';b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false')});[].forEach.call(ap.querySelectorAll('.bl-card'),function(c){c.hidden=false;c.classList.remove('bl-pop')});var ct=ap.querySelector('.bl-count');if(ct)ct.textContent=ap.querySelectorAll('.bl-card').length+' articles'}}cur=id;var sc=m.querySelector('.fm-scroll');if(sc)sc.scrollTop=0;P.forEach(function(p){pick(p,0)});var a=m.querySelector('.fm-panel:not([hidden]) h2');if(a)m.setAttribute('aria-labelledby',a.id);arm()}
function pick(p,i){[].forEach.call(p.querySelectorAll('.tb-b'),function(b){var o=+b.getAttribute('data-i')===i;b.classList.toggle('on',o);b.setAttribute('aria-selected',o?'true':'false');if(o){var l=b.parentNode;if(l.scrollWidth>l.clientWidth+4)l.scrollTo({left:Math.max(0,b.offsetLeft-20),behavior:'smooth'})}});
[].forEach.call(p.querySelectorAll('.tb-ex,.tb-cap'),function(x){x.classList.toggle('on',+x.getAttribute('data-i')===i)});var st=p.querySelector('.tb-stage');if(st)st.setAttribute('data-i',i)}
var io=null,sc0=m.querySelector('.fm-scroll'),tk=false;
function arm(){if(io)io.disconnect();var p=m.querySelector('.fm-panel:not([hidden])');if(!p||!('IntersectionObserver' in window)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
var T=[].slice.call(p.querySelectorAll('.pg-sec>h3,.tbx,.mo-c,.mo-also,.pg-good li,.pg-end h3,.pg-end .fm-cta,.pg-end .fm-avail,.fm-meth,.bl-card:not(.bl-x),.bl-topics,.bl-cta,.su-h,.su-c,.su-t2,.su-note'));
T.forEach(function(e,i){e.classList.remove('in');e.classList.add('rv');if(e.matches('.pg-ft'))e.classList.toggle('rl',!!e.closest('.pg-f:nth-child(even)'));if(e.matches('.pg-fa'))e.classList.toggle('rl',!e.closest('.pg-f:nth-child(even)'));var li=e.matches('.pg-good li,.mo-c,.bl-card,.su-c,.su-t2')?[].indexOf.call(e.parentNode.children,e):0;e.style.transitionDelay=(li*(e.matches('.mo-c')?70:e.matches('.bl-card')?90:50))+'ms'});
io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{root:sc0,threshold:.12,rootMargin:'0px 0px -6% 0px'});
T.forEach(function(e){io.observe(e)});par()}
function par(){tk=false;var p=m.querySelector('.fm-panel:not([hidden])');if(!p||!sc0)return;var r0=sc0.getBoundingClientRect(),c=r0.top+r0.height/2;[].forEach.call(p.querySelectorAll('.pg-f'),function(f){var r=f.getBoundingClientRect();if(r.bottom<r0.top-200||r.top>r0.bottom+200)return;var v=((r.top+r.height/2)-c)/r0.height;f.style.setProperty('--p',Math.max(-1,Math.min(1,v)).toFixed(3))})}
if(sc0)sc0.addEventListener('scroll',function(){if(!tk){tk=true;requestAnimationFrame(par)}},{passive:true});
function open(id,init){var was=m.hidden;if(was)last=document.activeElement;show(id);m.hidden=false;document.body.classList.add('about-open');var c=m.querySelector('.about-close');if(c)c.focus();
if(was&&!init)history.pushState({fm:1},'','#learn-'+id);else history.replaceState(init?null:history.state,'','#learn-'+id)}
function hide(){m.hidden=true;var ab=document.getElementById('about');if(!ab||ab.hidden)document.body.classList.remove('about-open');if(last&&last.focus)last.focus()}
function clean(){if(/^#learn-/.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}
function close(){if(history.state&&history.state.fm){history.back()}else{hide();clean()}}
window.addEventListener('popstate',function(){var q=location.hash.match(/^#learn-(practice|message|coach|more|support|blog-[a-z]+)$/);if(q){if(m.hidden)open(q[1],true);else show(q[1])}else if(!m.hidden)hide()});
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;var f=t.closest('[data-feature]');if(f){e.preventDefault();e.stopPropagation();open(f.getAttribute('data-feature'));return}
if(!m.hidden&&(t.classList.contains('fm-scroll')||t.classList.contains('fm-wrap'))){close();return}
var fl=t.closest('.bl-fl');if(fl){e.preventDefault();var pp2=fl.closest('.fm-panel'),kk=fl.getAttribute('data-t'),nn=0;[].forEach.call(pp2.querySelectorAll('.bl-fl'),function(b){b.classList.toggle('on',b===fl);b.setAttribute('aria-pressed',b===fl?'true':'false')});[].forEach.call(pp2.querySelectorAll('.bl-card'),function(c){var ok=kk==='all'||(' '+c.getAttribute('data-t')+' ').indexOf(' '+kk+' ')>-1;c.hidden=!ok;if(ok){nn++;c.classList.add('in');c.classList.remove('bl-pop');void c.offsetWidth;c.classList.add('bl-pop')}});var ct=pp2.querySelector('.bl-count');if(ct)ct.textContent=nn+' article'+(nn==1?'':'s');return}
var sm=t.closest('.bl-sm');if(sm){e.preventDefault();var pp=sm.closest('.fm-panel');[].forEach.call(pp.querySelectorAll('.bl-x'),function(x,i){x.hidden=false;x.classList.add('rv');x.style.transitionDelay=(i*90)+'ms';requestAnimationFrame(function(){requestAnimationFrame(function(){x.classList.add('in')})})});sm.hidden=true;return}
var tb=t.closest('.tb-b');if(tb){e.preventDefault();pick(tb.closest('.fm-panel'),+tb.getAttribute('data-i'));return}
var n=t.closest('.fm-next[data-go]');if(n){show(n.getAttribute('data-go'));history.replaceState(history.state,'','#learn-'+cur);return}
if(t.closest('[data-fclose]')&&!m.hidden){var link=t.closest('a[href^="#"]');if(link){hide();clean()}else close();if(!link)return}},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden)close()});
var h=location.hash.match(/^#learn-(practice|message|coach|more|support|blog-[a-z]+)$/);if(h)open(h[1],true);})();</script>"""

XM='''<div class="xm-row"><p><b>Nine more small tools</b> for after the chat ends.</p><div class="xm-btns"><a href="#learn-more" data-feature="more" class="hx-btn ghost" data-umami-event="explore-more-tools-deck">Explore more tools <span aria-hidden="true">&rarr;</span></a><a href="#join" class="hx-btn" data-umami-event="cta-tools">Get early access</a></div></div>'''

# ---- "Explore more tools": expandable panel under the three cards
_XT_IC={
 'After a fight':'<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
 'Playbook':'<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 8h7M9 12h5"/>',
 'Daily check-in and question':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 'Share with your partner':'<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
 'Therapist summary':'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
 'Weekly focus and ideas':'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
 'Insights':'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
 'Talk plan and hard mode':'<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
 'Monthly review and your year':'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'}
def _xt():
    items=''.join('<li class="xt-i%d"><span class="xt-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></span><div><h3>%s<em class="mo-p %s">%s</em></h3><p>%s</p></div></li>'%(i%3,_XT_IC[t],t,pl.lower(),pl,d) for i,(t,pl,d,art) in enumerate(MORE))
    return ('<div class="xt" id="xt"><button type="button" class="xt-btn" id="xt-btn" aria-expanded="false" aria-controls="xt-panel" data-umami-event="explore-more-tools">'
      '<span class="xt-t"><b>Explore more tools</b><small>Nine small tools for after the chat ends</small></span><i class="xt-chev" aria-hidden="true"></i></button>'
      '<div class="xt-panel" id="xt-panel" role="region" aria-labelledby="xt-btn" inert><div class="xt-clip"><ul class="xt-grid">'+items+'</ul>'
      '<p class="xt-foot"><a href="#learn-more" data-feature="more" data-umami-event="xt-open-window">See them all with examples <span aria-hidden="true">&rarr;</span></a></p></div></div></div>'
      '<script>(function(){var x=document.getElementById("xt"),b=document.getElementById("xt-btn"),p=document.getElementById("xt-panel");if(!x||!b||!p)return;b.addEventListener("click",function(){var o=b.getAttribute("aria-expanded")!=="true";b.setAttribute("aria-expanded",o?"true":"false");x.classList.toggle("open",o);if(o){p.removeAttribute("inert");setTimeout(function(){var r=b.getBoundingClientRect(),h=window.innerHeight;if(r.top<90||r.top>h*.35)window.scrollTo({top:r.top+window.scrollY-110,behavior:"smooth"})},180)}else p.setAttribute("inert","")})})();</script>')

# ---- landing: "See all articles" opens the all-articles window (with topic filter)
_sa='<a href="/blog/" class="btn btn-ghost">See all articles</a>'
assert _sa in s
s=s.replace(_sa,'<a href="#learn-blog-all" data-feature="blog-all" class="btn btn-ghost" data-umami-event="blog-see-all">See all articles</a>',1)
# ---- landing: the nine other tools live in their own window now
_a=s.index('<section class="hx-sec" id="more">'); _b=s.index('</section>',_a)+len('</section>')
s=s[:_a].rstrip()+'\n\n    '+s[_b:].lstrip()
s=_re.sub(r'<footer class="hx-foot">.*?</footer>',lambda mo:FOOT_HTML,s,count=1,flags=_re.S)
PBFIT_JS = """<script>(function(){var pb=document.querySelector('body > .page-bg'),f=document.querySelector('body > footer.hx-foot');if(!pb||!f)return;function fit(){pb.style.bottom='auto';pb.style.height=Math.max(0,f.getBoundingClientRect().top+window.scrollY)+'px'}fit();addEventListener('load',fit);addEventListener('resize',fit);if(window.ResizeObserver)new ResizeObserver(fit).observe(document.body);setTimeout(fit,600);setTimeout(fit,2000)})();(function(){[].forEach.call(document.querySelectorAll('.fm-wrap,.about-wrap'),function(w){var pb=w.querySelector(':scope > .page-bg'),site=w.querySelector('.fm-site');if(!pb||!site)return;function fit(){var h=site.getBoundingClientRect().top-w.getBoundingClientRect().top;if(h>0){pb.style.bottom='auto';pb.style.height=h+'px'}}if(window.ResizeObserver)new ResizeObserver(fit).observe(w);fit()})})();</script>"""
s=s.replace('</footer>','</footer>'+ABOUT_HTML+ABOUT_JS+FM_HTML+FM_JS+CMP_JS+ACC_JS+FIT_JS+PBFIT_JS,1)

# ---- nav: add "Our approach" link
s=_re.sub(r'(<a href="#tools">Features</a>\s*)(<a href="#pricing">Pricing</a>)',lambda m:m.group(1)+'<a href="#approach" data-nogate>Our approach</a>\n        '+m.group(2),s,count=1)
s=_re.sub(r'(<a href="#pricing">Pricing</a>\s*)(<a href="#faq">FAQ</a>)',lambda m:m.group(1)+'<a href="#blog" data-nogate>Blog</a>\n        '+m.group(2),s,count=1)

# ---- page-wide motion: floating hearts in hero and final card
s=s.replace('<section class="hx-hero">','<section class="hx-hero">'+FLOATS,1)
s=s.replace('<div class="hx-final hx-reveal">','<div class="hx-final hx-reveal">'+FLOATS,1)
s=s.replace('js/home.js?v=4','js/home.js?v=5')

# ---- our approach: richer layout
_MB_OLD=s[s.index('<div class="mission-block">'):s.index('</div></div>',s.index('Read our method'))+len('</div></div>')]
def _mbi(d): return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>'%d
_MB_CH=[('Gottman Method','g'),('Emotionally Focused Therapy','p'),('CBT for couples','c'),('Nonviolent Communication','k'),('Imago dialogue','p'),('Attachment theory','g'),('Solution-focused work','c'),('Narrative work','k'),('Acceptance and commitment','g')]
_AP_PTS=[('One job','Clearer thinking and better words. Nothing else.','#f7d99a','<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
 ('No hooks','No streaks, no guilt, no nagging.','#f4b8c4','<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
 ('Honest limits','It tells you when a professional should take over.','#f8c7a3','<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8v6M14 11h6"/>')]
_AP_CH=[('Gottman Method','g'),('Attachment theory','p'),('Emotionally Focused Therapy','c'),('Nonviolent Communication','k')]
_MB_NEW=('<div class="apr">'
 '<div class="apr-head"><span class="section-tag">Our approach</span><h2>We&rsquo;d rather be useful than exciting</h2>'
 '<p>Three tools with one job: help you think clearly and find words that land.</p></div>'
 '<div class="apr-pts">'+''.join('<div class="apr-pt"><span class="apr-ic" style="background:%s">%s</span><h3>%s</h3><p>%s</p></div>'%(c,_mbi(d),t,x) for t,x,c,d in _AP_PTS)+'</div>'
 '<div class="apr-meth"><div class="apr-by"><small>Guided by</small><div class="mb-chips">'+''.join('<b class="%s">%s</b>'%(k,t) for t,k in _AP_CH)+'<b class="apr-more">and more</b></div></div>'
 '<div class="apr-note"><span class="apr-nic">'+_mbi('<path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.8 4.5 6.2 4.5c2.1 0 3.7 1.2 4.6 2.7.4.6 1.4.6 1.8 0 .9-1.5 2.5-2.7 4.6-2.7 3.4 0 5.3 3.5 3.8 7.1C19.5 16.4 12 21 12 21z"/>')+'</span>'
 '<div><b>Not a replacement for therapy</b><a href="method.html" data-umami-event="approach-method">Read our method &amp; sources <span aria-hidden="true">&rarr;</span></a></div></div></div>'
 '</div>')
assert _MB_OLD in s
s=s.replace(_MB_OLD,_MB_NEW,1)
# move "Our approach" right under the three tools
_a=s.index('<section class="hx-sec" id="approach">'); _b=s.index('</section>',_a)+len('</section>')
_sec=s[_a:_b]; s=s[:_a].rstrip()+'\n\n    '+s[_b:].lstrip()
_c=s.index('<section class="hx-sec" id="compare">')
s=s[:_c]+_sec+'\n\n    '+s[_c:]

# ---- blog thumbnails on the home cards (shown on mobile only)
import glob as _g, os as _os
def _thumb(m):
    slug=m.group(1)
    if not _os.path.exists('/root/lp/img/blog/card-%s.svg'%slug): return m.group(0)
    src='/img/blog/card-%s.svg?v=1'%slug
    return m.group(0)+'\n  <span class="post-thumb"><img src="%s" alt="" width="800" height="450" loading="lazy" decoding="async" /></span>'%src
s=_re.sub(r'<a class="post-card" href="/blog/([^/"]+)/">',_thumb,s)

# ---- final CTA: add clover decoration
s=s.replace('<div class="hx-final hx-reveal">','<div class="hx-final hx-reveal">'+clover('fclover','f'))
# footer clover
s=s.replace('<body class="hx">','<body class="hx">'+PGBG,1)

# ---- pricing bullets in the same order: Partner Practice, Coach Chat, Message check
def _li(label):
    m=_re.search(r'<li>(?:(?!</li>).)*?<strong>'+_re.escape(label)+r'(?:(?!</li>).)*?</li>\n?\s*',s,_re.S)
    return m
m1=_li('Coach Chat:'); m2=_li('Message check:'); m3=_li('Partner Practice:')
if m1 and m2 and m3 and m1.end()<=m2.start() and m2.end()<=m3.start() and m3.start()-m1.start()<900:
    seg=s[m1.start():m3.end()]
    new=m3.group(0)+m1.group(0)+m2.group(0)
    s=s[:m1.start()]+new+s[m3.end():]

m_pp=_re.search(r'<li>(?:(?!</li>).)*?<strong>Partner Practice:</strong> unlimited(?:(?!</li>).)*?</li>\n?\s*',s,_re.S)
m_ac=_re.search(r'<li>(?:(?!</li>).)*?<strong>Advanced Coach Chat:</strong>(?:(?!</li>).)*?</li>\n?\s*',s,_re.S)
if m_pp and m_ac and m_pp.end()<m_ac.start() and m_ac.start()-m_pp.end()<1500:
    s=s[:m_pp.end()]+m_ac.group(0)+s[m_pp.end():m_ac.start()]+s[m_ac.end():]
open('/root/lp/index.html','w').write(s)
print('ok',len(s))


# =====================================================================
# method.html in the same theme (text and sources unchanged)
def _hash_to_index(h): return _re.sub(r'href="#',r'href="index.html#',h)
_nav=_hash_to_index(_re.search(r'<header class="hx-nav".*?</header>',s,flags=_re.S).group(0)).replace('<!--LANG-SWITCH--><!--/LANG-SWITCH-->','')
_foot=_hash_to_index(FOOT_HTML)
_pbg_all=_re.search(r'<div class="page-bg"[^>]*>(.*?)</div>\s*<',s,flags=_re.S)
_pb=''
if _pbg_all:
    parts=_pbg_all.group(1).split('<span class="pbg"')[1:]
    keep=[p for p in parts if int(_re.search(r'top:(-?\d+)px',p).group(1))<2600]
    _pb='<div class="page-bg" aria-hidden="true">'+''.join('<span class="pbg"'+p for p in keep)+'</div>'
def _src(href,label): return '<a class="mt-src" href="%s" target="_blank" rel="noopener"><i>'%href+_mbi('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')+'</i><span><small>Source</small>%s</span></a>'%label
_MT=[
 dict(n='01',h='The Gottman Method',used='Used in Coach Chat',ill='a1',
  p='Dr. John Gottman&rsquo;s research identified four communication patterns (criticism, contempt, defensiveness, and stonewalling) that reliably predict relationship breakdown. The Gottman Institute describes contempt (mockery, eye-rolling, sarcasm, treating a partner as inferior) as &ldquo;the single greatest predictor of divorce.&rdquo; RelationshipAI&rsquo;s Coach Chat is built to help you spot these patterns in your own words before you send them, and replace them with their known antidotes: starting a hard conversation gently, taking responsibility instead of getting defensive, and self-soothing instead of shutting down.',
  src=('https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/','The Gottman Institute, &ldquo;The Four Horsemen: Recognizing Criticism, Contempt, Defensiveness, and Stonewalling&rdquo;'),
  ex=AP('The four patterns','Gottman Institute','<div class="ap-two"><div>'+ROW('1','Criticism')+'</div><div>'+ROW('2','Contempt','pk')+'</div><div>'+ROW('3','Defensiveness')+'</div><div>'+ROW('4','Stonewalling')+'</div></div>','G')+SAT('<small>Known antidotes</small><span>Start gently. Take responsibility. Self-soothe.</span>','s2')),
 dict(n='02',h='Attachment theory',used='Used in Partner Practice',ill='a3',
  p='Attachment theory started with John Bowlby&rsquo;s work on why infants who are separated from a caregiver become distressed, and was extended by Mary Ainsworth&rsquo;s &ldquo;Strange Situation&rdquo; studies, which identified consistent patterns (securely attached, anxious, and avoidant) in how children respond to separation and reunion. In the 1980s, researchers Cindy Hazan and Phillip Shaver proposed that the same underlying system shapes how adults bond in romantic relationships, which is the basis for the &ldquo;secure / anxious / avoidant / disorganized&rdquo; language RelationshipAI uses when you describe your partner for Partner Practice. Knowing your pattern doesn&rsquo;t fix anything by itself, but it makes it a lot easier to recognize why the same disagreement keeps playing out the same way.',
  src=('https://labs.psychology.illinois.edu/~rcfraley/attachment.htm','R. Chris Fraley (University of Illinois), &ldquo;A Brief Overview of Adult Attachment Theory and Research&rdquo;'),
  ex=AP('How the idea grew','From infants to adults','<div class="ap-r"><small>Bowlby</small><span>Infants separated from a caregiver</span></div><div class="ap-r y"><small>Ainsworth</small><span>&ldquo;Strange Situation&rdquo; studies</span></div><div class="ap-r pk"><small>Hazan and Shaver, 1980s</small><span>The same system in adult romance</span></div>'+PILLS('Secure','Anxious','Avoidant','Disorganized'),'A')+SAT('<small>In RelationshipAI</small><span>The language you use to describe your partner.</span>','s2')),
 dict(n='03',h='Nonviolent Communication (NVC)',used='Used in Coach Chat rewrites',ill='m2',
  p='Nonviolent Communication is a framework developed by psychologist Marshall Rosenberg, laid out in his book <em>Nonviolent Communication: A Language of Life</em>. It&rsquo;s built around separating observations from judgments, naming the actual feeling underneath a complaint, and making a specific, actionable request instead of a vague accusation. It&rsquo;s the main thing Coach Chat is doing when it helps you rewrite &ldquo;you never listen to me&rdquo; into something that names the feeling and asks for something concrete. That&rsquo;s NVC&rsquo;s structure, not a generic &ldquo;be nicer&rdquo; pass.',
  src=('https://www.cnvc.org/store/nonviolent-communication-a-language-of-life','Center for Nonviolent Communication, Marshall B. Rosenberg, <em>Nonviolent Communication: A Language of Life</em>'),
  ex=AP('Rewrite with NVC','Observation, feeling, request',M('You never listen to me.')+'<div class="u-arr" style="align-self:center">&darr;</div>'+ROW('Names the feeling','&ldquo;I feel unheard.&rdquo;')+ROW('Specific request','&ldquo;Can we take ten minutes tonight?&rdquo;','y'),'N')+SAT('<small>Not a generic pass</small><span>A structure, not &ldquo;be nicer&rdquo;.</span>','s1')),
]
_mt_rows=''.join(
 '<div class="pg-f mt-f" id="m-%s"><div class="pg-ft"><span class="pg-n">%s</span><h2>%s</h2><span class="mt-used">%s</span><p>%s</p>%s</div><div class="pg-fa"><span class="dc d1"></span><span class="dc d2"></span><span class="dc d3"></span><div class="ex">%s</div></div></div>'
 %(['gottman','attachment','nvc'][i],m['n'],m['h'],m['used'],m['p'],_src(*m['src']),m['ex']) for i,m in enumerate(_MT))
_hero_art=''.join('<a class="mt-ha" href="#m-%s">%s<b>%s</b></a>'%(k,ILL[m['ill']],m['h'].replace(' (NVC)','')) for k,m in zip(['gottman','attachment','nvc'],_MT))
_ICK=_mbi('<path d="M5 12l4 4 10-10"/>'); _ICX=_mbi('<path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/>'); _ICH=_mbi('<path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.8 4.5 6.2 4.5c2.1 0 3.7 1.2 4.6 2.7.4.6 1.4.6 1.8 0 .9-1.5 2.5-2.7 4.6-2.7 3.4 0 5.3 3.5 3.8 7.1C19.5 16.4 12 21 12 21z"/>')
_hon=('<div class="mt-3">'
 '<div class="mt-c a"><i>'+_ICK+'</i><h3>What we can say</h3><p>These three frameworks are well-established in couples therapy and have decades of research behind them individually. What we can honestly say is that RelationshipAI&rsquo;s prompts and coaching logic are deliberately built around them, instead of generic &ldquo;be more understanding&rdquo; advice.</p></div>'
 '<div class="mt-c b"><i>'+_ICX+'</i><h3>What we can&rsquo;t say</h3><p>What we can&rsquo;t honestly say is that talking to an AI about your relationship has itself been clinically studied the way in-person therapy has. It hasn&rsquo;t been, by us or (as far as we know) by anyone else building AI coaching tools yet.</p></div>'
 '<div class="mt-c c"><i>'+_ICH+'</i><h3>So what is it?</h3><p>RelationshipAI is a tool for thinking more clearly between the moments that matter, not a replacement for a licensed therapist, and we&rsquo;d rather tell you that plainly than let the framework names do more talking than they should.</p></div></div>')
_head_m=s[:s.index('<body')]
_head_m=_re.sub(r'<title>.*?</title>','<title>Our Method · RelationshipAI</title>',_head_m,flags=_re.S)
_head_m=_re.sub(r'<meta name="description"[^>]*/>','<meta name="description" content="The research RelationshipAI&#39;s coaching is grounded in (the Gottman Method, attachment theory, and Nonviolent Communication) with sources, not just name-dropping." />',_head_m)
_head_m=_re.sub(r'\s*<meta property="og:[^>]*/>','',_head_m); _head_m=_re.sub(r'\s*<meta name="twitter:[^>]*/>','',_head_m)
_head_m=_re.sub(r'<link rel="canonical"[^>]*/>','<link rel="canonical" href="https://relationshipaiadvice.com/method" />',_head_m)
_head_m=_re.sub(r'\s*<script type="application/ld\+json">.*?</script>','',_head_m,flags=_re.S).replace('<!--LANG-ALTS--><!--/LANG-ALTS-->','')
_method=(_head_m+'<body class="hx mt">'+_pb+_nav+'<main>'
 '<section class="mt-hero"><div class="hx-wrap">'+FLOATS+'<span class="section-tag">Our method</span>'
 '<h1>Grounded in real research, <em>not just name-dropped</em></h1>'
 '<p class="mt-lead">A lot of AI relationship apps mention &ldquo;evidence-based frameworks&rdquo; without saying which ones, or citing anything. Here&rsquo;s exactly what RelationshipAI&rsquo;s coaching is built on, and where those ideas actually come from.</p>'
 '<div class="mt-has">'+_hero_art+'</div></div></section>'
 '<section class="hx-sec mt-sec"><div class="hx-wrap"><div class="pg-fs">'+_mt_rows+'</div></div></section>'
 '<section class="hx-sec mt-sec"><div class="hx-wrap"><div class="hx-head hx-reveal"><span class="hx-kicker">Honest by design</span><h2>What this does and doesn&rsquo;t mean</h2></div>'+_hon+'</div></section>'
 '<section class="hx-sec"><div class="hx-wrap"><div class="hx-final">'+FLOATS+'<h2>See it applied to something you&rsquo;re actually dealing with</h2><p class="sub">Try Coach Chat free, no card required.</p><a href="index.html#join" class="hx-btn" data-umami-event="cta-method-banner">Get early access</a></div></div></section>'
 '</main>'+_foot+'<script src="js/home.js?v=5"></script></body></html>')
open('/root/lp/method.html','w').write(_method)
print('method ok',len(_method))
