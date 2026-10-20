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
s=s.replace('css/home.css?v=11','css/home.css?v=16')
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
        <div class="tool-cards">
          <a class="tcard t1 hx-reveal" href="#practice" data-umami-event="card-practice">
            <span class="tnum">01</span><span class="when">Before the talk</span>
            <h3>Partner Practice</h3>
            <p>Rehearse the hard conversation with an AI that plays your partner.</p>
            <div class="tmini"><div class="tb a">I want to tell you something.</div><div class="tb u">Okay. I&rsquo;m listening.</div></div>
            <span class="go">See how it works</span>
          </a>
          <a class="tcard t2 hx-reveal" href="#message" data-umami-event="card-check">
            <span class="tnum">02</span><span class="when">Before you send</span>
            <h3>Message check</h3>
            <p>See how your message will land, then get a calmer version.</p>
            <div class="tmini"><div class="tb x"><s>You never listen to me.</s></div><div class="tb u ok"><b>Calmer</b>I felt unheard earlier. Can we talk?</div></div>
            <span class="go">See how it works</span>
          </a>
          <a class="tcard t3 hx-reveal" href="#coach" data-umami-event="card-coach">
            <span class="tnum">03</span><span class="when">When it hurts</span>
            <h3>Coach Chat</h3>
            <p>A coach that remembers your story and gives real next steps.</p>
            <div class="tmini"><div class="tmem"><i></i>Remembers: the Tuesday dishes fight</div><div class="tb u">Let&rsquo;s look underneath it this time.</div></div>
            <span class="go">See how it works</span>
          </a>
        </div>
        <div class="hx-center-cta hx-reveal"><a href="#join" class="hx-btn" data-umami-event="cta-tools">Get early access</a> <span class="hx-free">Free to try</span></div>
        <div class="hx-frame hx-center-frame"><b>Inspired by</b><span>The Gottman Method</span><i></i><span>Attachment theory</span><i></i><span>Nonviolent Communication</span></div>
      </div>
    </section>'''
s=s[:a]+tools+s[b:]

# ---- final CTA: add clover decoration
s=s.replace('<div class="hx-final hx-reveal">','<div class="hx-final hx-reveal">'+clover('fclover','f'))
# footer clover
open('/root/lp/index.html','w').write(s)
print('ok',len(s))
