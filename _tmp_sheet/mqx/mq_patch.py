import re,sys
p=sys.argv[1]
s=open(p).read()
terms=["The Gottman Method","Attachment theory","Emotionally Focused Therapy","Nonviolent Communication"]
li=''.join('<li>%s</li>'%t for t in terms*2)
mq='<div class="mq" role="region" aria-label="Guided by: The Gottman Method, Attachment theory, Emotionally Focused Therapy, Nonviolent Communication"><div class="mq-track"><ul>%s</ul><ul aria-hidden="true">%s</ul></div></div>'%(li,li)
# remove old strip wrapper
s=re.sub(r'<div class="hx-wrap"><div class="meth-strip"[^>]*>.*?</div></div>\s*','',s,count=1,flags=re.S)
if 'class="mq"' not in s:
    k=s.index('</section>', s.index('<section class="hx-hero"'))+len('</section>')
    s=s[:k]+'\n\n    '+mq+s[k:]
if 'css/marquee.css' not in s:
    s=re.sub(r'(<link rel="stylesheet" href="css/quotes\.css[^>]*>)',r'\1\n  <link rel="stylesheet" href="css/marquee.css?v=1" />',s,count=1)
open(p,'w').write(s)
print('meth-strip' in s, s.count('class="mq"'), 'marquee.css' in s)
