import re
OLD = open('/root/lp/old-index.html').read()
old_lines = OLD.split('\n')

# ---------- head (kept from the original: meta, hreflang alts, icons, umami, JSON-LD) ----------
head = '\n'.join(old_lines[:51])
head = head.replace('<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />',
                    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />')
head = head.replace('  <link rel="stylesheet" href="css/style.css?v=67" />\n  <link rel="stylesheet" href="css/landing.css?v=23" />\n', '  <link rel="stylesheet" href="css/home.css?v=10" />\n')
assert 'home.css' in head and 'Inter:wght' in head
head += '\n  <meta name="theme-color" content="#130b0f" />\n</head>'
lang = [l for l in old_lines if '<!--LANG-SWITCH-->' in l][0].strip()
s0 = next(i for i, l in enumerate(old_lines) if '<!--BLOG-LATEST-->' in l)
e0 = next(i for i, l in enumerate(old_lines) if '<!--/BLOG-LATEST-->' in l)
blog = '\n'.join(old_lines[s0:e0 + 1])


# ---------- helpers to lift original blocks ----------
def balanced(html, start):
    """return the balanced <div ...>...</div> block that starts at index start"""
    depth = 0
    for m in re.finditer(r'<div\b|</div>', html[start:]):
        depth += 1 if m.group(0) != '</div>' else -1
        if depth == 0:
            return html[start:start + m.end()]
    raise ValueError('unbalanced')


def block(cls, tag_attr=None):
    i = OLD.index(f'<div class="{cls}"')
    return balanced(OLD, i)


def btn(h):
    h = h.replace('class="btn btn-gradient btn-block"', 'class="hx-btn block"').replace('class="btn btn-ghost btn-block"', 'class="hx-btn ghost block"')
    h = h.replace('class="btn btn-gradient"', 'class="hx-btn"').replace('class="btn btn-ghost btn-sm"', 'class="hx-btn ghost sm"')
    h = h.replace('class="btn btn-ghost"', 'class="hx-btn ghost"')
    # plan buttons -> links to the signup form
    h = re.sub(r'<button type="button" class="(hx-btn[^"]*)" (data-plan="[^"]*" data-umami-event="[^"]*" data-umami-event-billing="[^"]*")>(.*?)</button>',
               r'<a href="#join" class="\1" \2>\3</a>', h)
    h = h.replace('href="#" class="hx-btn', 'href="#join" class="hx-btn')
    return h


more_grid = block('more-grid')
more_also = re.search(r'<p class="more-also">.*?</p>', OLD, re.S).group(0)
mission = block('mission-block')
peek_host = block('peek-host')
compare_note = re.search(r'<p class="compare-note">.*?</p>', OLD, re.S).group(0)
trust_row = block('trust-row')
faq = block('faq')
pricing_grid = block('pricing-grid')
plan_compare = re.search(r'<details class="plan-compare">.*?</details>', OLD, re.S).group(0)
assur = block('pricing-assurances')
pricing_note = re.search(r'<p class="pricing-note">.*?</p>', OLD, re.S).group(0)
billing = block('billing-toggle')
# strip the decorative peek images inside pricing cards
pricing_grid = re.sub(r'\s*<img class="peek[^>]*>', '', pricing_grid)
peek_host = re.sub(r'\s*<img class="peek[^>]*>', '', peek_host)
mission = btn(mission)
faq = faq.replace('<details class="faq-item">', '<details class="faq-item">')
pricing_grid = btn(pricing_grid)

CHECK = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'


def form(i, src):
    return f'''<form class="hx-form" id="{i}-form" data-source="{src}" novalidate>
            <label class="hx-sr" for="{i}-email">Email address</label>
            <input type="email" id="{i}-email" placeholder="Your email" autocomplete="email" inputmode="email" maxlength="254" required />
            <input type="text" id="{i}-website" class="hx-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <button type="submit" class="hx-btn" data-umami-event="cta-{i}">Get early access</button>
          </form>
          <p class="hx-err" id="{i}-error" role="alert" hidden></p>
          <p class="hx-done" id="{i}-done" hidden><strong>You're on the list.</strong> We'll email you once, the day RelationshipAI opens.</p>'''


IC_CHAT = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>'
IC_MSG = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/></svg>'
IC_PRAC = '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>'
IC_PEN = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>'
IC_EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'

body = f'''
<body class="hx">
  <header class="hx-nav" id="nav">
    <div class="hx-wrap">
      <a href="index.html" class="hx-brand"><img src="logo-mark.svg" alt="" width="34" height="34" /><span>Relationship<b>AI</b></span></a>
      <button class="hx-burger" id="burger" aria-label="Menu" aria-expanded="false">☰</button>
      <nav class="hx-links" id="links">
        <a href="#demo">Try it</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="/blog/">Blog</a>
        <a href="#faq">FAQ</a>
        {lang}
        <a href="#join" class="hx-btn sm" data-umami-event="cta-nav-button">Get early access</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hx-hero">
      <span class="fb fb1">We need to talk.</span>
      <span class="fb fb2">You never listen to me.<small>May land as blame</small></span>
      <span class="fb fb3">I miss us.</span>
      <span class="fb fb4">Can we talk tonight?<small>Calmer</small></span>
      <div class="hx-wrap hx-center">
        <div class="hx-copy">
          <span class="hx-kicker big"><i></i>AI relationship coach</span>
          <h1><span class="hx-l1">Know what to say</span><span class="hx-rot" aria-live="off"><em class="on">before you send.</em><em>after a fight.</em><em>when it&rsquo;s hard.</em><em>at 2am.</em></span></h1>
          <p class="hx-sub">Talk through a conflict, check a message before you send it, and rehearse the hard conversation. A private coach that remembers your story and is there at 2am.</p>
          {form('hero', 'hero-inline')}
          <p class="hx-note"><b>Free to start</b> · No card · One email when we open</p>
          <div class="hx-frame"><b>Inspired by</b><span>The Gottman Method</span><i></i><span>Attachment theory</span><i></i><span>Nonviolent Communication</span></div>
        </div>

      </div>
    </section>

    <div class="hx-chatband" aria-hidden="true">
      <div class="hx-track">
        <span class="cb a">We need to talk.</span><span class="cb r">Fine. Whatever.</span><span class="cb b">I miss you.</span><span class="cb a">Did I do something wrong?</span><span class="cb g">Can we start over?</span><span class="cb r">You never listen.</span><span class="cb g">I hear you.</span><span class="cb b">I'm sorry I hurt you.</span>
        <span class="cb a">We need to talk.</span><span class="cb r">Fine. Whatever.</span><span class="cb b">I miss you.</span><span class="cb a">Did I do something wrong?</span><span class="cb g">Can we start over?</span><span class="cb r">You never listen.</span><span class="cb g">I hear you.</span><span class="cb b">I'm sorry I hurt you.</span>
      </div>
    </div>

    <div class="hx-perks" aria-label="Why people like it">
      <div class="hx-wrap">
        <div class="hx-perk"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg><div><b>Free to start</b><span>No card needed</span></div></div>
        <div class="hx-perk"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 118 0v3"/></svg><div><b>Private</b><span>Only you see your chats</span></div></div>
        <div class="hx-perk"><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg><div><b>There at 2am</b><span>No waiting, no booking</span></div></div>
        <div class="hx-perk"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg><div><b>16 languages</b><span>Write in your own</span></div></div>
      </div>
    </div>

    <section class="hx-sec" id="demo" style="padding-bottom:40px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal" style="margin-bottom:44px">
          <span class="hx-kicker">Try it yourself</span>
          <h2>See how one message can <em>change the whole talk</em>.</h2>
          <p>Pick a situation. Watch what Message check does with the first draft.</p>
        </div>
        <div class="hx-demo hx-reveal" id="demo-box">
          <div class="dm-pick" role="tablist" aria-label="Choose a situation">
            <button type="button" class="on" data-i="0">They forgot something</button>
            <button type="button" data-i="1">They went quiet</button>
            <button type="button" data-i="2">The same chores fight</button>
            <button type="button" data-i="3">Who were you texting?</button>
          </div>
          <div class="dm-cols">
            <div class="dm-card dm-before">
              <small>Your first draft</small>
              <p id="dm-draft"></p>
              <span class="hx-risk" id="dm-risk"></span>
              <div class="mtr"><i style="left:84%"></i></div>
              <div class="mtr-l"><span>Calm</span><span>Heated</span></div>
            </div>
            <div class="dm-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
            <div class="dm-card dm-after">
              <small>What the coach suggests</small>
              <div class="dm-tone" role="tablist" aria-label="Choose a tone">
                <button type="button" class="on" data-t="calm">Calmer</button>
                <button type="button" data-t="warm">Warmer</button>
                <button type="button" data-t="direct">More direct</button>
              </div>
              <p id="dm-fix"></p>
              <span class="dm-why" id="dm-why"></span>
            </div>
          </div>
          <div class="dm-foot">
            <span>Example, not a live chat. Early access gives you the real thing, with your own words.</span>
            <a href="#join" class="hx-btn" data-umami-event="cta-demo">Try it with my message</a>
          </div>
        </div>
      </div>
    </section>

    <section class="hx-sec" id="examples" style="padding-top:40px;padding-bottom:30px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal" style="margin-bottom:44px">
          <span class="hx-kicker">Real situations</span>
          <h2>Same feeling. <em>Better words.</em></h2>
          <p>The things people most often get stuck on, and a way to say them that gets heard.</p>
        </div>
        <div class="hx-gal hx-reveal">
          <article><small>When they pull away</small><p class="no">&ldquo;Why are you ignoring me?&rdquo;</p><p class="yes">&ldquo;I miss you lately. Can we catch up tonight?&rdquo;</p></article>
          <article><small>After an argument</small><p class="no">&ldquo;Fine. You win.&rdquo;</p><p class="yes">&ldquo;I want to fix this, not win it. Can we try again?&rdquo;</p></article>
          <article><small>Asking for space</small><p class="no">&ldquo;You&rsquo;re suffocating me.&rdquo;</p><p class="yes">&ldquo;I need a quiet evening to recharge. It&rsquo;s not about you.&rdquo;</p></article>
          <article><small>Saying sorry</small><p class="no">&ldquo;Sorry you feel that way.&rdquo;</p><p class="yes">&ldquo;I&rsquo;m sorry I hurt you. I see why it landed that way.&rdquo;</p></article>
          <article><small>Setting a boundary</small><p class="no">&ldquo;Stop calling me at work.&rdquo;</p><p class="yes">&ldquo;I can&rsquo;t pick up at work. Can we talk after six?&rdquo;</p></article>
          <article><small>Talking about money</small><p class="no">&ldquo;You spend way too much.&rdquo;</p><p class="yes">&ldquo;Can we look at our budget together this weekend?&rdquo;</p></article>
        </div>
        <div class="hx-gal-cta hx-reveal"><a href="#join" class="hx-btn" data-umami-event="cta-gallery">Get help with mine</a></div>
      </div>
    </section>

    <section class="hx-sec" id="quiz" style="padding-top:50px;padding-bottom:30px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal" style="margin-bottom:40px">
          <span class="hx-kicker">30 second quiz</span>
          <h2>How do you handle <em>conflict</em>?</h2>
          <p>Four quick questions. Find out your pattern and what to try next time.</p>
        </div>
        <div class="hx-quiz hx-reveal" id="quiz-box">
          <div class="qz-bar"><i id="qz-prog"></i></div>
          <div class="qz-body" id="qz-body"></div>
          <p class="qz-note">For fun and reflection, not a diagnosis. Nothing you pick here is stored.</p>
        </div>
      </div>
    </section>

    <section class="hx-sec" id="how" style="padding-bottom:30px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal" style="margin-bottom:44px">
          <span class="hx-kicker">How it works</span>
          <h2>From "ugh" to "I know what to say" in <em>minutes</em>.</h2>
        </div>
        <div class="hx-steps hx-reveal">
          <div class="hx-step">{IC_PEN}<h3>Tell it what happened</h3><p>In your own words. Type, dictate, or add a screenshot.</p></div>
          <div class="hx-step">{IC_EYE}<h3>See how it may land</h3><p>Get patterns, honest feedback and specific next steps.</p></div>
          <div class="hx-step">{IC_MSG}<h3>Say it with confidence</h3><p>Send a better message, or rehearse the conversation first.</p></div>
        </div>
      </div>
    </section>

    <section class="hx-sec" id="features">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <span class="hx-kicker">The three main tools</span>
          <h2>Understand it, word it, <em>practice it</em>.</h2>
          <p>Start with any one of them. Each takes only a few minutes, and all three are free to try.</p>
        </div>

        <div class="tool-row hx-reveal" id="tool-coach">
          <div class="tool-copy">
            <span class="hx-tag">01 · Coach Chat <em>Free to try</em></span>
            <h3>A coach that already knows your story</h3>
            <p>Describe what happened in your own words. It remembers your partner and your earlier chats, so you never start from zero.</p>
            <ul class="core-list">
              <li><span><strong>Specific next steps</strong>, not vague comfort</span></li>
              <li><span><strong>Spots patterns</strong> you might miss, like "you both go quiet after an argument"</span></li>
              <li><span><strong>Always there</strong>, even at 2am. You can add screenshots or documents for context</span></li>
            </ul>
            <a href="#join" class="hx-btn" data-umami-event="cta-mode-coach">Try Coach Chat</a>
          </div>
          <div class="tool-vis">
            <div class="mini">Coach Chat · example</div>
            <div class="bub u">We had the same fight again.</div>
            <div class="bub a">Same as last Tuesday, when the dishes turned into "you never help"? Let's look at what's underneath it this time.</div>
            <div class="bub u">I just feel like I'm doing everything.</div>
            <div class="bub a">That sounds exhausting, and unseen. Is it the dishes, or the feeling that your effort isn't noticed?</div>
            <div class="chips"><span>Remembers last week</span><span>Spots patterns</span><span>Sees both sides</span></div>
            <div class="try"><small>Try this</small>"I feel unseen when I carry the house alone. Can we split it differently?"</div>
          </div>
        </div>

        <div class="tool-row flip hx-reveal" id="tool-message">
          <div class="tool-copy">
            <span class="hx-tag">02 · Message check <em>Start here</em></span>
            <h3>Read your message the way they will</h3>
            <p>Paste a message before you hit send. In a few seconds you see how it may land and get versions you can send as they are.</p>
            <ul class="core-list">
              <li><span><strong>Blame, pressure or sarcasm</strong> gets pointed out</span></li>
              <li><span><strong>2 or 3 better versions</strong>: calmer, more direct, or warmer</span></li>
              <li><span><strong>Not stored.</strong> We keep only a counter, so we can apply your plan's limit</span></li>
            </ul>
            <a href="#join" class="hx-btn" data-umami-event="cta-mode-message">Try Message check</a>
          </div>
          <div class="tool-vis rose">
            <div class="mini">Message check · example</div>
            <div class="bub bad" style="max-width:100%">You never listen to me. I'm tired of always having to ask for everything.</div>
            <div class="mtr"><i></i></div>
            <div class="mtr-l"><span>Calm</span><span>May land as blame</span></div>
            <div class="bub good" style="max-width:100%"><b>Calmer:</b> "I felt unheard earlier. Can we talk tonight?"</div>
            <div class="bub good" style="max-width:100%"><b>Warmer:</b> "I love you, and I want us to sort this out together."</div>
          </div>
        </div>

        <div class="tool-row hx-reveal" id="tool-practice">
          <div class="tool-copy">
            <span class="hx-tag">03 · Partner Practice <em>Free to try</em></span>
            <h3>Say it out loud before it's real</h3>
            <p>Describe your partner and rehearse with an AI that plays them, pushback included. Then get a short, honest debrief.</p>
            <ul class="core-list">
              <li><span><strong>A debrief every time</strong>: what went well, what to watch for, what to try next</span></li>
              <li><span><strong>Switch roles</strong> to hear how your own words might sound to them</span></li>
              <li><span><strong>Completely private.</strong> It never contacts your real partner</span></li>
            </ul>
            <a href="#join" class="hx-btn" data-umami-event="cta-mode-practice">Try Partner Practice</a>
          </div>
          <div class="tool-vis sage">
            <div class="mini">Practicing with Sam · example</div>
            <div class="bub u">I've noticed we haven't really talked lately. Can we find time this weekend?</div>
            <div class="bub a">Yeah... it's just been a lot lately. I don't really know what there is to say.</div>
            <div class="bub u">I'm not blaming you. I just miss us.</div>
            <div class="dbr">
              <div><strong>Went well</strong><span>You opened without blame and named what you miss.</span></div>
              <div><strong>Watch for</strong><span>They may go quiet. Give them room instead of filling the silence.</span></div>
              <div><strong>Try next</strong><span>Offer one small, specific thing: "Walk Sunday morning?"</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="hx-sec" id="more" style="padding-top:30px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <span class="hx-kicker">And more</span>
          <h2>Small tools that help after the <em>chat ends</em>.</h2>
          <p>Each one has a plan label, so you always know what is free and what comes with Pro or Premium.</p>
        </div>
        <div class="hx-reveal">
          {more_grid}
          {more_also}
        </div>
      </div>
    </section>

    <section class="hx-sec" id="why" style="padding-top:20px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <h2>A friend takes your side.<br/><span class="hx-grad"><em>A coach helps you both.</em></span></h2>
        </div>
        <div class="hx-vs hx-reveal">
          <div class="vs-card dim">
            <h3>Venting to a friend</h3>
            <ul>
              <li><i>✕</i>Always on your side</li>
              <li><i>✕</i>Forgets by morning</li>
              <li><i>✕</i>Feeds the fight</li>
            </ul>
          </div>
          <div class="vs-card win">
            <h3>RelationshipAI</h3>
            <ul>
              <li><i>✓</i>Sees both sides</li>
              <li><i>✓</i>Remembers your story</li>
              <li><i>✓</i>Helps you actually fix it</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="hx-sec" id="compare" style="padding-top:20px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <span class="hx-kicker">How it stacks up</span>
          <h2>Not a replacement for therapy. Not a <em>generic chatbot</em> either.</h2>
          <p>RelationshipAI sits in between: easier to reach than a therapist, and more useful for relationships than a general AI assistant.</p>
        </div>
        <div class="hx-reveal">{peek_host}{compare_note}</div>
      </div>
    </section>

    <section class="hx-sec" id="approach" style="padding-top:20px">
      <div class="hx-wrap hx-reveal">{mission}</div>
    </section>

    <section class="hx-sec" id="trust" style="padding-top:20px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal">
          <span class="hx-kicker">Built to be safe to be honest in</span>
          <h2>What you tell it <em>stays yours</em>.</h2>
        </div>
        <div class="hx-reveal">{trust_row}</div>
      </div>
    </section>

    <section class="hx-sec" id="pricing">
      <div class="hx-wrap pricing-wrap">
        <div class="hx-head hx-reveal" style="margin-bottom:36px">
          <span class="hx-kicker">Pricing</span>
          <h2>Start free. <em>Upgrade when it helps.</em></h2>
          <p>Free lets you really try all three main tools. Pro takes the limits away. Premium adds the deeper tools for the conversations that matter most.</p>
        </div>
        <div class="hx-reveal">
          {billing}
          {pricing_grid}
          {plan_compare}
          {assur}
          {pricing_note}
        </div>
      </div>
    </section>

    {blog}

    <section class="hx-sec" id="faq" style="padding-top:20px">
      <div class="hx-wrap">
        <div class="hx-head hx-reveal"><span class="hx-kicker">FAQ</span><h2>Still have <em>questions</em>?</h2></div>
        <div class="hx-reveal">{faq}</div>
      </div>
    </section>

    <section class="hx-sec" id="join" style="padding-top:20px">
      <div class="hx-wrap">
        <div class="hx-final hx-reveal">
          <h2>Your next conversation can go <span class="hx-grad"><em>better.</em></span></h2>
          <p class="sub">Try Coach Chat, Message check and Partner Practice. Join the early access list and we'll write once, the day we open.</p>
          {form('join', 'final-inline')}
          <p class="hx-note">Free to start · No card · No spam</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="hx-foot">
    <div class="hx-wrap">
      <p>RelationshipAI is an AI tool for personal growth and does not replace professional psychological or therapeutic care. If you're in a crisis, please contact a professional or a helpline in your country.</p>
      <p>© 2026 RelationshipAI · <a href="/blog/">Blog</a> · <a href="method.html">Method</a> · <a href="https://www.instagram.com/relationshipai_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-footer">@relationshipai_</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p>
    </div>
  </footer>

  <a href="#join" class="hx-btn sm hx-sticky" id="sticky" data-umami-event="cta-floating">Get early access</a>
  <script src="js/home.js?v=4"></script>
</body>
</html>
'''
open('/root/lp/index.html', 'w').write(head + '\n' + body)
print('ok', len(head + body))
