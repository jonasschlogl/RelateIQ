import math,os,sys
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'cards.py')).read().split('S={}')[0]
exec(src)
K='2026-10-08-how-attachment-styles-work-in-relationships'
def rr(x,y,w,h,r,fill,rot=0,sw=SW,cx=None,cy=None,op=1):
    t=f' transform="rotate({rot} {x+w/2 if cx is None else cx} {y+h/2 if cy is None else cy})"' if rot else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" fill-opacity="{op}" stroke="{COCOA}" stroke-width="{sw}"{t}/>'
def circ(x,y,r,fill,sw=SW,extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{COCOA}" stroke-width="{sw}" {extra}/>'
def pth(d,fill='none',sw=SW,stroke=COCOA,extra='',op=1):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-opacity="{op}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def arrow(d,hx,hy,ang,c=COCOA,sw=6,dash=''):
    h=f'<path d="M-14 -13 L10 0 L-14 13 Z" fill="{c}" stroke="{c}" stroke-width="3" stroke-linejoin="round" transform="translate({hx} {hy}) rotate({ang})"/>'
    return pth(d,sw=sw,stroke=c,extra=(f'stroke-dasharray="{dash}"' if dash else ''))+h
def check(x,y,r=26,fill=GOLD):
    return circ(x,y,r,fill,3.5)+pth(f'M{x-r*.42} {y+r*.02} L{x-r*.1} {y+r*.34} L{x+r*.46} {y-r*.32}',sw=5.5)
def face(kind):
    if kind=='calm': return f'<path d="M34 44 q6 6 12 0 M54 44 q6 6 12 0" fill="none" stroke="{COCOA}" stroke-width="3.2" stroke-linecap="round"/><path d="M44 58 q6 5 12 0" fill="none" stroke="{COCOA}" stroke-width="3.2" stroke-linecap="round"/>'
    if kind=='joy': return f'<path d="M32 46 q7 -9 14 0 M54 46 q7 -9 14 0" fill="none" stroke="{COCOA}" stroke-width="3.2" stroke-linecap="round"/><path d="M42 56 q8 11 16 0 Z" fill="{COCOA}"/>'
    if kind=='worry': return f'<circle cx="38" cy="46" r="4.2" fill="{COCOA}"/><circle cx="62" cy="46" r="4.2" fill="{COCOA}"/><path d="M30 36 l12 -4 M70 36 l-12 -4" stroke="{COCOA}" stroke-width="3" stroke-linecap="round"/><path d="M42 61 q8 -6 16 0" fill="none" stroke="{COCOA}" stroke-width="3.2" stroke-linecap="round"/>'
    if kind=='away': return f'<circle cx="44" cy="46" r="4.2" fill="{COCOA}"/><circle cx="66" cy="46" r="4.2" fill="{COCOA}"/><path d="M50 60 h14" stroke="{COCOA}" stroke-width="3.2" stroke-linecap="round"/>'
    return ''
def cup(x,y,s=1,tea=PEACH):
    o=f'<g transform="translate({x} {y}) scale({s})">'
    o+=pth('M-70 -10 H70 V40 C70 90 40 115 0 115 C-40 115 -70 90 -70 40 Z',fill=PAPER)
    o+=f'<ellipse cx="0" cy="-10" rx="70" ry="16" fill="{tea}" stroke="{COCOA}" stroke-width="{SW}"/>'
    o+=pth('M70 10 C115 5 115 65 62 62',sw=SW)
    o+=pth('M-90 125 H90',sw=SW)
    o+='</g>'
    return o
def steam(x,y):
    return pth(f'M{x} {y} c-14 -22 14 -34 0 -58',sw=5,op=.6)+pth(f'M{x+34} {y+6} c-14 -22 14 -34 0 -58',sw=5,op=.6)
D={}
# ---------- attachment 2: pursue and withdraw
b=shadow(330,548,150)+shadow(870,548,120)
b+=f'<path d="M300 150 C420 40 780 40 880 150" fill="none" stroke="{COCOA}" stroke-opacity=".4" stroke-width="5" stroke-dasharray="3 14" stroke-linecap="round"/>'
b+=hcenter(330,340,3.2,PINK,rot=-8,extra=face('worry'))
b+=hcenter(880,340,2.5,PEACH,rot=8,extra=face('away'))
for i,y in enumerate((300,350,400)): b+=pth(f'M{500-i*10} {y} h{90-i*10}',sw=6,op=.55)
for i,y in enumerate((300,350,400)): b+=pth(f'M{1030+i*8} {y} h{70}',sw=6,op=.55)
b+=arrow('M480 200 C540 190 590 200 640 232',650,236,28)
b+=spark(150,500,22)+spark(1050,520,18)+spark(600,520,16)+spark(240,150,14)
D[(K,2)]=wrap(PINK,b)
# ---------- attachment 3: growth steps
b=shadow(600,560,330)
for i,(x,h,c) in enumerate(((250,110,CREAM),(450,210,PEACH),(650,310,GOLD))):
    b+=rr(x,560-h,200,h,10,c)
b+=rr(850,560-410,200,410,10,PINK)
b+=hcenter(950,80,1.7,CREAM,extra=face('joy'))
b+=pth('M340 410 c0 -30 -8 -48 -26 -62 M340 410 c4 -26 18 -40 38 -46',sw=SW)
b+=f'<path d="M314 348 c-26 -8 -34 -30 -28 -46 c24 4 34 24 28 46Z" fill="{GOLD}" stroke="{COCOA}" stroke-width="3.5" stroke-linejoin="round"/><path d="M378 364 c22 -12 24 -34 14 -48 c-22 8 -26 28 -14 48Z" fill="{CREAM}" stroke="{COCOA}" stroke-width="3.5" stroke-linejoin="round"/>'
b+=arrow('M300 300 C420 230 560 210 700 140',712,134,-28,dash='3 14')
b+=spark(1080,120,24)+spark(160,200,18)+spark(560,90,16)
D[(K,3)]=wrap(GOLD,b)
# ---------- apology 2: notepad with 3 checked steps
K='2026-10-08-how-to-apologize-to-your-partner'
b=shadow(600,566,300)
b+=rr(330,90,540,450,28,PAPER,rot=-3)
b+='<g transform="rotate(-3 600 315)">'
for i in range(7): b+=rr(372+i*70,70,26,46,13,COCOA,sw=0)
b+=rr(330,90,540,70,28,GOLD).replace('rx="28"','rx="28"')
for i,w in enumerate((300,330,250)):
    y=225+i*100
    b+=check(410,y,30,[PINK,GOLD,PEACH][i])+line(470,y,470+w,9,COCOA,.85)+line(470,y+30,470+w-90,6,DEEP,.45)
b+='</g>'
b+=hcenter(850,500,1.2,PINK,rot=14,extra=face('calm'))
b+=f'<g transform="rotate(35 960 230)">{rr(930,110,60,260,12,GOLD)}{pth("M930 370 L960 430 L990 370 Z",fill=PEACH)}{rr(930,110,60,34,10,PINK)}</g>'
b+=spark(180,160,22)+spark(1070,500,16)
D[(K,2)]=wrap(PINK,b)
# ---------- apology 3: clock + tea cooling
b=shadow(330,556,190)+shadow(850,556,170)
cx,cy=330,300
b+=circ(cx,cy,200,PAPER)+circ(cx,cy,172,CREAM,2.5)
for k in range(12):
    a=math.radians(k*30-90); b+=pth(f'M{cx+150*math.cos(a):.1f} {cy+150*math.sin(a):.1f} L{cx+(162 if k%3 else 140)*math.cos(a):.1f} {cy+(162 if k%3 else 140)*math.sin(a):.1f}',sw=5)
b+=pth(f'M{cx} {cy} L{cx} {cy-110}',sw=9)+pth(f'M{cx} {cy} L{cx+78} {cy+46}',sw=9)
b+=circ(cx,cy,16,PINK)
b+=hcenter(cx,cy+205+8,0,PINK) if False else ''
b+=cup(850,330,1.45,PEACH)+steam(790,200)
b+=hcenter(850,130,.85,PINK,extra='',rot=0)
b+=spark(560,150,22)+spark(1100,480,16)+spark(150,520,14)
D[(K,3)]=wrap(GOLD,b)
# ---------- overthinking 2: facts vs story
K='2026-10-08-how-to-stop-overthinking-in-a-relationship'
b=shadow(600,566,420)
b+=rr(110,120,420,380,30,PAPER,rot=-3)+rr(670,130,420,380,30,PAPER,rot=3)
b+=rr(110,120,420,70,30,GOLD,rot=-3)+rr(670,130,420,70,30,PINK,rot=3)
b+='<g transform="rotate(-3 320 310)">'
for i in range(3): b+=check(170,260+i*80,24,[GOLD,PEACH,PINK][i])+line(215,260+i*80,215+[190,230,150][i],9,COCOA,.85)
b+='</g><g transform="rotate(3 880 320)">'
b+=pth('M720 270 c40 -50 70 50 110 0 c30 -40 60 40 95 -4 c20 -20 40 5 45 20',sw=6,stroke=DEEP)
b+=pth('M720 340 c40 -50 70 50 110 0 c30 -40 60 40 95 -4 c20 -20 40 5 45 20',sw=6,stroke=DEEP,op=.7)
b+=circ(850,435,20,PAPER,3.5)+circ(900,470,11,PAPER,3.5)
b+='</g>'
b+=circ(600,330,46,COCOA,0)+pth('M578 318 h44 M578 342 h44 M590 304 l20 52',stroke=CREAM,sw=6)
b+=spark(100,540,18)+spark(1100,90,20)
D[(K,2)]=wrap(PEACH,b)
# ---------- overthinking 3: breathing rings
b=''
for i,(r,o) in enumerate(((300,.14),(230,.2),(160,.28))):
    b+=f'<circle cx="600" cy="320" r="{r}" fill="#fff" fill-opacity="{o}" stroke="{COCOA}" stroke-opacity=".35" stroke-width="3" stroke-dasharray="3 14" stroke-linecap="round"/>'
b+=shadow(600,570,140)+hcenter(600,320,2.7,PINK,extra=face('calm'))
for dx in (-1,1):
    x0=600+dx*330
    b+=pth(f'M{x0} 250 q{dx*60} 20 {dx*120} 0 M{x0} 320 q{dx*60} 20 {dx*120} 0 M{x0} 390 q{dx*60} 20 {dx*120} 0',sw=6,op=.55)
b+=f'<path d="M130 520 c10 -60 60 -90 110 -90 c0 55 -40 95 -110 90Z" fill="{GOLD}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
b+=f'<path d="M1070 520 c-10 -60 -60 -90 -110 -90 c0 55 40 95 110 90Z" fill="{CREAM}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
b+=spark(240,130,20)+spark(980,110,24)+spark(1090,300,14)
D[(K,3)]=wrap(GOLD,b)
# ---------- habits 2: start soft
K='2026-10-05-relationship-advice-communication-habits'
b=shadow(600,566,320)
b+=pth('M300 130 H900 a46 46 0 0 1 46 46 V350 a46 46 0 0 1 -46 46 H520 L430 470 L450 396 H300 a46 46 0 0 1 -46 -46 V176 a46 46 0 0 1 46 -46 Z',fill=PAPER)
b+=hcenter(600,262,2.0,PINK,extra=face('calm'))
b+=pth('M820 452 H1010 a34 34 0 0 1 34 34 V510 a34 34 0 0 1 -34 34 H800 L770 566 L780 540 H820 a34 34 0 0 1 -34 -34 V486 a34 34 0 0 1 34 -34Z'.replace('a34 34 0 0 1 -34 -34 V486','').replace('H820 a34','H820 Z M0 0 M820 540 a34').replace('L780 540 ',''),fill=PEACH) if False else ''
b+=pth('M826 440 H1010 a36 36 0 0 1 36 36 V514 a36 36 0 0 1 -36 36 H800 L772 584 L780 550 a36 36 0 0 1 -26 -36 V476 a36 36 0 0 1 36 -36 Z',fill=PEACH)
b+=circ(850,495,7,COCOA,0)+circ(926,495,7,COCOA,0)+circ(1002,495,7,COCOA,0)
b+=f'<path d="M210 540 V430" stroke="{COCOA}" stroke-width="{SW}" stroke-linecap="round" fill="none"/>'+f'<path d="M210 470 c-30 -4 -44 -26 -40 -44 c28 2 42 20 40 44Z" fill="{GOLD}" stroke="{COCOA}" stroke-width="3.5" stroke-linejoin="round"/>'+f'<path d="M210 446 c28 -4 42 -24 38 -42 c-28 2 -40 20 -38 42Z" fill="{CREAM}" stroke="{COCOA}" stroke-width="3.5" stroke-linejoin="round"/>'
b+=spark(1060,150,24)+spark(140,200,18)+spark(700,520,14)
D[(K,2)]=wrap(PINK,b)
# ---------- habits 3: take a break
b=shadow(430,566,230)+shadow(900,566,150)
cx,cy=430,310
b+=circ(cx,cy,215,PAPER)+f'<circle cx="{cx}" cy="{cy}" r="188" fill="none" stroke="{PINK}" stroke-width="22"/>'
a=math.radians(-90+240); x2=cx+188*math.cos(a); y2=cy+188*math.sin(a)
b+=f'<path d="M{cx} {cy-188} A188 188 0 1 1 {x2:.1f} {y2:.1f}" fill="none" stroke="{GOLD}" stroke-width="22" stroke-linecap="round"/>'
b+=rr(cx-70,cy-80,50,160,14,COCOA,sw=0)+rr(cx+20,cy-80,50,160,14,COCOA,sw=0)
b+=cup(900,380,1.1,PEACH)+steam(860,262)
b+=hcenter(900,150,1.15,PINK,extra=face('calm'))
b+=spark(150,130,22)+spark(1100,230,18)+spark(700,120,14)
D[(K,3)]=wrap(PEACH,b)
# ---------- fix 2: calm the temperature (gauge)
K='2026-10-04-how-to-fix-a-relationship'
b=shadow(600,560,300)
cx,cy,R=600,430,300
def seg(a0,a1,r0,r1,c):
    p=lambda a,r:(cx+r*math.cos(math.radians(a)),cy+r*math.sin(math.radians(a)))
    x0,y0=p(a0,r1);x1,y1=p(a1,r1);x2,y2=p(a1,r0);x3,y3=p(a0,r0)
    return f'<path d="M{x0:.1f} {y0:.1f} A{r1} {r1} 0 0 1 {x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f} A{r0} {r0} 0 0 0 {x3:.1f} {y3:.1f} Z" fill="{c}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
for i,c in enumerate((GOLD,CREAM,PINK,DEEP)): b+=seg(180+i*45+(1.5 if i else 0),180+(i+1)*45-1.5,190,300,c)
b+=f'<g transform="rotate(32 {cx} {cy})">'+pth(f'M{cx} {cy} L{cx-230} {cy}',sw=10)+'</g>'
b+=circ(cx,cy,38,PAPER)+hcenter(cx,cy+2,.34,PINK,sw=3,extra='')
b+=arrow('M920 250 C960 330 960 400 940 470',938,478,98)
b+=spark(150,160,22)+spark(1060,140,18)+spark(250,500,14)
D[(K,2)]=wrap(PEACH,b)
# ---------- fix 3: polaroids on a line
b=shadow(600,570,380)
b+=pth('M60 110 C300 190 900 190 1140 110',sw=5)
def polaroid(x,y,rot,inner,icon):
    o=f'<g transform="rotate({rot} {x+110} {y+130})">'
    o+=rr(x,y,220,260,16,PAPER)+rr(x+18,y+34,184,160,10,inner,sw=3)+icon(x+110,y+114)
    o+=rr(x+92,y-30,36,64,8,GOLD,sw=3.5)+'</g>'
    return o
sun=lambda x,y:circ(x,y,34,GOLD,3.5)+''.join(pth(f'M{x+46*math.cos(math.radians(a)):.0f} {y+46*math.sin(math.radians(a)):.0f} L{x+60*math.cos(math.radians(a)):.0f} {y+60*math.sin(math.radians(a)):.0f}',sw=4) for a in range(0,360,45))
heart=lambda x,y:hcenter(x,y,1.3,PINK,sw=3.5,extra=face('joy'))
mug=lambda x,y:cup(x,y+6,.55,PEACH)
b+=polaroid(130,200,-6,PEACH,sun)+polaroid(490,215,2,GOLD,heart)+polaroid(850,200,7,PINK,mug)
b+=spark(100,520,20)+spark(1100,480,22)+spark(600,100,16)
D[(K,3)]=wrap(PINK,b)
# ---------- problems 2: chores balance
K='2026-10-03-relationship-problems-that-keep-coming-back'
b=shadow(600,566,230)
b+=pth('M600 190 V540',sw=14)+rr(470,520,260,40,16,CREAM)+circ(600,190,26,COCOA)
b+=pth('M240 190 H960',sw=12)
for sx,sgn in ((240,-1),(960,1)):
    b+=pth(f'M{sx} 190 L{sx-90} 390 M{sx} 190 L{sx+90} 390',sw=5)
    b+=pth(f'M{sx-110} 390 H{sx+110} C{sx+100} 450 {sx-100} 450 {sx-110} 390Z',fill=PAPER)
for i,c in enumerate((GOLD,PINK,PEACH,CREAM)):
    b+=f'<ellipse cx="240" cy="{372-i*26}" rx="84" ry="17" fill="{c}" stroke="{COCOA}" stroke-width="{SW}"/>'
b+=hcenter(960,300,1.9,PINK,extra=face('joy'))
b+=spark(100,120,20)+spark(1090,150,22)+spark(600,100,16)
D[(K,2)]=wrap(PEACH,b)
# ---------- problems 3: closeness meet in the middle
b=shadow(250,552,150)+shadow(950,552,110)
b+=pth('M410 340 H790',sw=6,op=.5,extra='stroke-dasharray="3 16"')
b+=hcenter(250,340,3.2,PINK,extra=face('worry'),rot=0)
b+=hcenter(960,340,2.1,PEACH,extra=face('away'))
b+=arrow('M400 330 H560',575,330,0)+arrow('M800 330 H640',625,330,180)
b+=pth('M600 220 V470',sw=6)+f'<path d="M604 230 L720 262 L604 300 Z" fill="{GOLD}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
b+=circ(600,480,14,COCOA,0)
b+=spark(150,130,22)+spark(1070,130,18)+spark(600,560,14)
D[(K,3)]=wrap(GOLD,b)
