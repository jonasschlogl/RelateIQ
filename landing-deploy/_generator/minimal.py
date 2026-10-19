import re
p='/root/lp/index.html'
s=open(p).read()

def cut_section(i):
    global s
    s,n=re.subn(r'\n[ ]*<section[^>]*id="%s"[^>]*>.*?</section>\n'%i,'\n',s,count=1,flags=re.S); assert n==1,i
# remove chatband + perks (everything up to demo section)
a=s.index('<div class="hx-chatband"'); a=s.rfind('\n',0,a)+1
b=s.index('<section class="hx-sec dark" id="demo"'); b=s.rfind('\n',0,b)+1
s=s[:a]+s[b:]
for i in ['how','examples','quiz','why']: cut_section(i)
# floating hero bubbles
s,n=re.subn(r'\s*<span class="fb fb\d">.*?</span>','',s,flags=re.S); assert n==4
# nav
s=s.replace('<a href="#demo">Try it</a>\n        ','').replace('<a href="/blog/">Blog</a>\n        ','',1)
# demo: drop meter
s,n=re.subn(r'\s*<div class="mtr">.*?</div>\s*<div class="mtr-l">.*?</div>','',s,count=1,flags=re.S); assert n==1
# plain sections
s=s.replace('hx-sec dark','hx-sec').replace('hx-sec alt','hx-sec')
# features -> three simple columns
IC1='<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>'
IC2='<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/></svg>'
IC3='<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>'
feat=f'''<section class="hx-sec" id="features">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <span class="hx-kicker">Three tools</span>
          <h2>Understand it, word it, <em>practice it</em>.</h2>
        </div>
        <div class="hx-tri hx-reveal">
          <article id="tool-coach">{IC1}<h3>Coach Chat</h3><p>A coach that already knows your story. It remembers your partner and your past chats, so you never start from zero.</p><span class="hx-free">Free to try</span></article>
          <article id="tool-message">{IC2}<h3>Message check</h3><p>Read your message the way they will. See how it may land and get better versions. Never stored.</p><span class="hx-free">Free to try</span></article>
          <article id="tool-practice">{IC3}<h3>Partner Practice</h3><p>Say it out loud before it's real. Rehearse with an AI that plays them, then get a short debrief. Completely private.</p><span class="hx-free">Free to try</span></article>
        </div>
        <div class="hx-center-cta hx-reveal"><a href="#join" class="hx-btn" data-umami-event="cta-features">Get early access</a></div>
      </div>
    </section>
'''
s,n=re.subn(r'<section class="hx-sec" id="features">.*?</section>\n',lambda m:feat,s,count=1,flags=re.S); assert n==1
# FAQ trims
def faq_del(q):
    global s
    s,n=re.subn(r'\s*<details class="faq-item">\s*<summary>'+re.escape(q)+r'</summary>.*?</details>','',s,count=1,flags=re.S); assert n==1,q
for q in ['What AI does it use?','What happens when I reach a Free plan limit?','Can I share things with my partner?']: faq_del(q)
open(p,'w').write(s)
print('ok',len(s))
