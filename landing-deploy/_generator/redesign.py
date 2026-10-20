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

# ---- head
s=re.sub(r'<link href="https://fonts.googleapis.com/css2\?[^"]*" rel="stylesheet" />',
 '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />',s)
s=s.replace('css/home.css?v=11','css/home.css?v=12')
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
          <p class="hx-sub">Talk it through, check a message before you send it, rehearse the hard talk. A private coach, there at 2am.</p>
          {form}
        </div>
        <div class="hero-art" aria-hidden="true">
          <i class="blob b1"></i><i class="blob b2"></i>
          {clover('clover','h')}
          <div class="chip c1"><small>You</small>We need to talk.</div>
          <div class="chip c2"><small>Coach</small>Take a breath. Here is a calmer way to say it.</div>
          <div class="chip c3"><b>&#10003;</b> Calmer version ready</div>
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
