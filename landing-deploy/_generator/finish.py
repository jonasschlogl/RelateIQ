import re
p='/root/lp/index.html'
s=open(p).read()
m0=s.index('<main>')+len('<main>'); m1=s.index('</main>')
main=s[m0:m1]
order=['<div class="hx-chatband"','<div class="hx-perks"','id="demo"','id="how"','id="features"','id="examples"','id="quiz"','id="more"','id="why"','id="compare"','id="trust"','id="approach"','id="pricing"','<!--BLOG-LATEST-->','id="faq"','id="join"']
idx=[]
for k in order:
    i=main.index(k); idx.append(main.rfind('\n',0,i)+1)
head=main[:min(idx)]
srt=sorted(idx)
seg={}
for n,k in enumerate(order):
    st=idx[n]; nxt=[x for x in srt if x>st]; en=nxt[0] if nxt else len(main)
    seg[k]=main[st:en]
assert sum(len(v) for v in seg.values())+len(head)==len(main)
# hero is in head (before perks) -> keep
new=head+''.join(seg[k] for k in order)
new=new.replace('<section class="hx-sec" id="demo"','<section class="hx-sec dark" id="demo"')
for sid in ['quiz','why','compare','pricing','faq']:
    new=new.replace(f'<section class="hx-sec" id="{sid}"',f'<section class="hx-sec alt" id="{sid}"')
new=re.sub(r'(<section class="hx-sec[^"]*" id="[a-z]+") style="[^"]*"',r'\1',new)
s=s[:m0]+new+s[m1:]
open(p,'w').write(s)
print('ok')
