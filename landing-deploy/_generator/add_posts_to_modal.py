#!/usr/bin/env python3
"""Adds blog posts to the hand-built 'All articles' window and topic windows inside landing-page/index.html.
Run from anywhere:  python3 landing-deploy/_generator/add_posts_to_modal.py
Edit NEW below (slug -> topics). Card text is read from landing-page/blog/index.html (run `node build-blog.mjs` first). Safe to run twice."""
import re, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
NEW={ # slug: topics (attachment, communication, conflict, repair, overthinking)
 'date-night-questions-for-couples':['communication'],
 'deep-questions-to-ask-your-partner':['communication'],
 'how-to-say-i-love-you-without-words':['communication'],
 'green-flags-in-a-relationship':['attachment'],
 'how-to-rebuild-trust-after-a-fight':['conflict','repair'],
}
idx_path=os.path.join(ROOT,'landing-page','index.html'); s=open(idx_path,encoding='utf-8').read()
blog=open(os.path.join(ROOT,'landing-page','blog','index.html'),encoding='utf-8').read()
def meta(sl):
    m=re.search(r'<a class="post-card" href="/blog/%s/">(.*?)</a>'%re.escape(sl),blog,re.S); b=m.group(1)
    g=lambda p: re.search(p,b,re.S).group(1)
    return dict(tag=g(r'<span class="post-tag">(.*?)</span>'),meta=g(r'<span class="post-meta">(.*?)</span>'),ti=g(r'<h3>(.*?)</h3>'),ds=g(r'<p>(.*?)</p>'))
ARROW=re.search(r'<span class="post-more">Read article (<svg.*?</svg>)</span>',s,re.S).group(1)
import glob
def KEY(sl):
    f=glob.glob(os.path.join(ROOT,'landing-page','img','blog','*-'+sl+'-1.jpg'))[0]
    return os.path.basename(f)[:-6]
def card(sl,m,pre,dt=None,x=False):
    return ('<a class="post-card bl-card%s" href="/blog/%s/"%s%s data-umami-event="%s-%s"><span class="post-thumb"><img src="/img/blog/%s-1.jpg?v=5" alt="" width="1200" height="630" loading="lazy"></span>'
            '<div class="post-card-top"><span class="post-tag">%s</span><span class="post-meta">%s</span></div><h3>%s</h3><p>%s</p><span class="post-more">Read article %s</span></a>')%(
            ' bl-x' if x else '',sl,' hidden' if x else '',(' data-t="%s"'%dt) if dt else '',pre,sl,KEY(sl),m['tag'],m['meta'],m['ti'],m['ds'],ARROW)
CARD_RE=re.compile(r'<a class="post-card bl-card[^>]*href="/blog/([^/"]+)/".*?</a>',re.S)
def panel_bounds(pid):
    i=s.index('id="%s"'%pid); i=s.rfind('<article',0,i); j=s.index('</article>',i)+len('</article>'); return i,j
# ---- All articles window
i,j=panel_bounds('learn-blog-all'); p=s[i:j]
have=set(CARD_RE.findall(p)); add=''
for sl,tp in NEW.items():
    if sl not in have: add+=card(sl,meta(sl),'blog-all',' '.join(tp))
if add:
    p=p.replace('<div class="bl-list">','<div class="bl-list">'+add,1)
    n=len(CARD_RE.findall(p)); p=re.sub(r'<span class="bl-count">[^<]*</span>','<span class="bl-count">%d articles</span>'%n,p)
    s=s[:i]+p+s[j:]
# ---- topic windows
for topic in ('attachment','communication','conflict','repair','overthinking'):
    mine=[sl for sl,tp in NEW.items() if topic in tp]
    i,j=panel_bounds('learn-blog-%s'%topic); p=s[i:j]
    have=CARD_RE.findall(p); mine=[x for x in mine if x not in have]
    if not mine: continue
    a=p.index('<div class="bl-list">')+len('<div class="bl-list">'); old=[]; b=a
    for m in CARD_RE.finditer(p,a):
        if m.start()!=b: break
        old.append(m.group(0)); b=m.end()
    def strip(c): return re.sub(r' hidden(?= data-umami)','',c.replace(' bl-x"','"',1))
    cards=[card(sl,meta(sl),'blog-topic-%s'%topic) for sl in mine]+[strip(c) for c in old]
    out=''
    for n,c in enumerate(cards):
        if n>=3: c=c.replace('post-card bl-card','post-card bl-card bl-x',1).replace('/" data-umami','/" hidden data-umami',1) if ' hidden' not in c else c
        out+=c
    p=p[:a]+out+p[b:]
    if len(cards)>3 and 'class="bl-sm"' not in p: p=p.replace('<div class="bl-topics">','<button type="button" class="bl-sm" data-show><span>Show more</span></button><div class="bl-topics">',1)
    p=re.sub(r'<span class="bl-count">[^<]*</span>','<span class="bl-count">%d articles</span>'%len(cards),p)
    s=s[:i]+p+s[j:]
open(idx_path,'w',encoding='utf-8').write(s); print('ok')
