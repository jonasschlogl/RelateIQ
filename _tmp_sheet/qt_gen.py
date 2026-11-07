import re,sys
p=sys.argv[1]
Q=[("When you are missing someone, time seems to move slower, and when I\u2019m falling in love with someone, time seems to be moving faster.","Taylor Swift","Singer-songwriter","T"),
("The central idea of love is not even a relationship commitment, the first thing is a personal commitment to be the best version of yourself with or without that person that you\u2019re with.","Will Smith","Actor","W"),
("Just because you\u2019re with someone it doesn\u2019t mean you\u2019re incredibly happy and complete.","George Clooney","Actor and filmmaker","G"),
("The best thing to hold onto in life is each other.","Audrey Hepburn","Actress and humanitarian","A"),
("Lots of people want to ride with you in the limo, but you want someone who will take the bus with you when the limo breaks down.","Oprah Winfrey","Media icon","O"),
("Spread love everywhere you go. Let no one ever come to you without leaving happier.","Mother Teresa","Humanitarian and Nobel laureate","M")]
sl=''.join('<figure class="qt-slide%s"><p>“%s”</p><figcaption class="qt-by"><span class="qt-av" aria-hidden="true" style="display:grid">%s</span><div><b>%s</b><span>%s</span></div></figcaption></figure>'%(' on' if i==0 else '',q,a,n,r) for i,(q,n,r,a) in enumerate(Q))
dots=''.join('<button type="button" aria-label="Quote %d"%s></button>'%(i+1,' class="on"' if i==0 else '') for i in range(len(Q)))
html='<div class="qt-root" id="qt-root" role="region" aria-label="Words on love"><div class="qt-card"><p class="qt-eyebrow">Words on love</p><div class="qt-stage">%s</div><div class="qt-dots">%s</div></div></div>'%(sl,dots)
s=open(p).read()
a=s.index('<div class="qt-root" id="qt-root"')
m=re.search(r'<div class="qt-dots">.*?</div></div></div>', s[a:], re.S)
s=s[:a]+html+s[a+m.end():]
open(p,'w').write(s); print(s.count('qt-root'))
