import re
p='/root/lp/index.html'
s=open(p).read()

# nav
s=s.replace('<a href="#features">Features</a>','<a href="#tools">Features</a>')

# hero: move "Inspired by" row out
s,n=re.subn(r'\s*<div class="hx-frame">.*?</div>\n(?=\s*</div>\s*\n\s*</div>\s*\n\s*</section>)','\n',s,count=1,flags=re.S); assert n==1,'frame'
FRAME='<div class="hx-frame hx-center-frame"><b>Inspired by</b><span>The Gottman Method</span><i></i><span>Attachment theory</span><i></i><span>Nonviolent Communication</span></div>'

# take the interactive demo box out of the old demo section
m=re.search(r'<div class="hx-demo hx-reveal" id="demo-box">.*?\n        </div>\n      </div>\n    </section>',s,flags=re.S); assert m
demo_box=m.group(0)
demo_box=demo_box[:demo_box.rindex('      </div>\n    </section>')].rstrip()

def arch(n,cls,when,title,txt,img,href):
    return f'''<a class="arch {cls} hx-reveal" href="{href}" data-umami-event="arch-{img}">
            <figure><img src="img/scene-{img}.svg?v=3" alt="" width="360" height="470"><i class="num">{n}</i></figure>
            <span class="when">{when}</span>
            <h3>{title}</h3>
            <p>{txt}</p>
            <span class="go">See how it works</span>
          </a>'''

tools=f'''<section class="hx-sec hx-tools" id="tools">
      <div class="hx-wrap">
        <div class="hx-arches">
          {arch(1,'a1','Before the talk','Partner Practice','Rehearse the hard conversation with an AI that plays your partner.','practice','#practice')}
          {arch(2,'a2','Before you send','Message check','See how your message will land, then get a calmer version.','check','#message')}
          {arch(3,'a3','When it hurts','Coach Chat','A coach that remembers your story and gives real next steps.','coach','#coach')}
        </div>
        <div class="hx-center-cta hx-reveal"><a href="#join" class="hx-btn" data-umami-event="cta-tools">Get early access</a> <span class="hx-free">Free to try</span></div>
        {FRAME}
      </div>
    </section>
'''

def head(num,when,title,txt,facts):
    f=''.join(f'<li>{x}</li>' for x in facts)
    return f'''<div class="chap-copy hx-reveal">
            <span class="chap-num"><b>{num}</b>{when}</span>
            <h2>{title}</h2>
            <p>{txt}</p>
            <ul class="chap-facts">{f}</ul>
          </div>'''

ch1=f'''<section class="hx-sec chap" id="practice">
      <div class="hx-wrap chap-row">
        {head('01','Before the talk','Say it out loud <em>before it&rsquo;s real</em>.','An AI plays your partner, so you can find the words with nothing at stake. Then get a short debrief.',['Completely private','Free to try'])}
        <div class="chap-vis hx-reveal">
          <div class="mock">
            <div class="mock-top"><i></i>Practice &middot; you&rsquo;re talking to &ldquo;Alex&rdquo; <em>Example</em></div>
            <div class="bub u">There&rsquo;s something I want to tell you.</div>
            <div class="bub a">Okay. I&rsquo;m listening.</div>
            <div class="bub u">When plans change last minute, I feel unimportant.</div>
            <div class="bub a">I didn&rsquo;t know it hurt you. Tell me more.</div>
            <div class="mock-deb"><small>Debrief</small><p>Calm start, clear feeling. <b>Next time:</b> add what you need.</p></div>
          </div>
        </div>
      </div>
    </section>
'''

ch2=f'''<section class="hx-sec chap chap-wide" id="message">
      <div class="hx-wrap">
        {head('02','Before you send','Read it the way <em>they will</em>.','Check a message before you send it. See how it may land and get calmer, warmer or more direct versions.',['Never stored','Free to try'])}
        {demo_box}
      </div>
    </section>
'''

ch3=f'''<section class="hx-sec chap flip" id="coach">
      <div class="hx-wrap chap-row">
        {head('03','When it hurts','A coach that <em>already knows</em> your story.','Tell it what happened. It remembers your partner and your past chats, so you never start from zero. There at 2am.',['Remembers you','Free to try'])}
        <div class="chap-vis hx-reveal">
          <div class="mock">
            <div class="mock-top"><i></i>Coach Chat <em>Example</em></div>
            <div class="bub u">We had the same fight again.</div>
            <div class="bub a">Same as last Tuesday, when the dishes turned into &ldquo;you never help&rdquo;? Let&rsquo;s look underneath it this time.</div>
            <div class="bub u">I just feel like I&rsquo;m doing everything.</div>
            <div class="mock-deb"><small>Try this</small><p>&ldquo;I feel unseen when I carry the house alone. Can we split it differently?&rdquo;</p></div>
          </div>
        </div>
      </div>
    </section>
'''

# replace old demo + features sections
s,n=re.subn(r'<section class="hx-sec" id="demo">.*?</section>\n',lambda m:tools+'    '+ch1+'    '+ch2+'    '+ch3,s,count=1,flags=re.S); assert n==1,'demo'
s,n=re.subn(r'\s*<section class="hx-sec" id="features">.*?</section>\n','\n',s,count=1,flags=re.S); assert n==1,'features'
# demo: drop its own foot span tone
s=s.replace('<span>Example, not a live chat. Early access gives you the real thing, with your own words.</span>','<span>Example, not a live chat. Early access gives you the real thing.</span>')
s=s.replace('css/home.css?v=10','css/home.css?v=11')
open(p,'w').write(s)
print('ok')
