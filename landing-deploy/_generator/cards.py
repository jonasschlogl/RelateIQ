import math
GOLD='#f7d99a';PINK='#f4b8c4';PEACH='#f8c7a3';BROWN='#b78d74';COCOA='#3b2218';CREAM='#fff3e2';PAPER='#fffaf2';DEEP='#8a4a30'
HP='M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z'
SW=4
def heart(x,y,s,fill,rot=0,sw=SW,extra=''):
    # tip of heart at (x,y), pointing down when rot=0; scale s
    return f'<g transform="translate({x} {y}) rotate({rot}) scale({s}) translate(-50 -88)"><path d="{HP}" fill="{fill}" stroke="{COCOA}" stroke-width="{sw/s:.2f}" stroke-linejoin="round"/>{extra}</g>'
def hcenter(cx,cy,s,fill,rot=0,sw=SW,extra=''):
    # heart centred (body centre ~ (50,48))
    return f'<g transform="translate({cx} {cy}) rotate({rot}) scale({s}) translate(-50 -48)"><path d="{HP}" fill="{fill}" stroke="{COCOA}" stroke-width="{sw/s:.2f}" stroke-linejoin="round"/>{extra}</g>'
def spark(x,y,r,fill=CREAM):
    p=f'M{x} {y-r} L{x+r*.28} {y-r*.28} L{x+r} {y} L{x+r*.28} {y+r*.28} L{x} {y+r} L{x-r*.28} {y+r*.28} L{x-r} {y} L{x-r*.28} {y-r*.28} Z'
    return f'<path d="{p}" fill="{fill}" stroke="{COCOA}" stroke-width="2.5" stroke-linejoin="round"/>'
def bg(c,extra=''):
    return (f'<rect width="1200" height="630" fill="{c}"/>'
      '<circle cx="150" cy="120" r="210" fill="#fff" fill-opacity=".22"/><circle cx="150" cy="120" r="140" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>'
      '<circle cx="1090" cy="86" r="42" fill="#3b2218" fill-opacity=".10"/>'
      '<circle cx="1120" cy="610" r="230" fill="#fff" fill-opacity=".2"/>'+extra)
def shadow(cx,cy,rx,ry=20):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{COCOA}" fill-opacity=".14"/>'
def wrap(c,body,extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-hidden="true">{bg(c,extra)}{body}</svg>'
def line(x1,y,x2,w=7,c=COCOA,op=1):
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{c}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="round"/>'

S={}
# 1 attachment styles: four hearts forming the clover, one per style, tied by a dashed orbit
cx,cy=600,315
cols=[CREAM,PINK,PEACH,BROWN]
b=f'<circle cx="{cx}" cy="{cy}" r="285" fill="none" stroke="{COCOA}" stroke-opacity=".35" stroke-width="3" stroke-dasharray="3 14" stroke-linecap="round"/>'
b+=shadow(cx,545,230)
for k,a in enumerate((0,90,180,270)):
    b+=heart(cx,cy,2.6,cols[k],rot=a)
b+=f'<circle cx="{cx}" cy="{cy}" r="32" fill="{COCOA}"/><circle cx="{cx}" cy="{cy}" r="11" fill="{GOLD}"/>'
b+=spark(250,500,26)+spark(960,150,22)+spark(990,470,18)+spark(215,250,16)
S['how-attachment-styles-work-in-relationships']=wrap(GOLD,b)

# 2 apology: letter with heart seal, flowers
b=shadow(600,552,260)
b+=f'<rect x="440" y="170" width="320" height="240" rx="18" fill="{PAPER}" stroke="{COCOA}" stroke-width="{SW}" transform="rotate(-5 600 290)"/>'
for i,w in enumerate((200,240,150)):
    b+=f'<g transform="rotate(-5 600 290)">{line(480,215+i*34,480+w,7,DEEP,.55)}</g>'
b+=f'<rect x="360" y="270" width="480" height="280" rx="26" fill="{CREAM}" stroke="{COCOA}" stroke-width="{SW}"/>'
b+=f'<path d="M370 288 L600 450 L830 288" fill="none" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round"/>'
b+=f'<path d="M362 540 L540 392 M838 540 L660 392" stroke="{COCOA}" stroke-width="{SW}" stroke-linecap="round" fill="none"/>'
b+=f'<path d="M376 272 L600 452 L824 272 Z" fill="{PEACH}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
b+=hcenter(600,432,1.05,PINK)
def flower(x,y,r,c1,c2):
    o=''
    for k in range(6):
        a=k*60;px=x+r*math.cos(math.radians(a));py=y+r*math.sin(math.radians(a))
        o+=f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r*.62:.1f}" fill="{c1}" stroke="{COCOA}" stroke-width="3"/>'
    return o+f'<circle cx="{x}" cy="{y}" r="{r*.55:.1f}" fill="{c2}" stroke="{COCOA}" stroke-width="3"/>'
b+=f'<path d="M930 560 C910 470 940 400 980 330" fill="none" stroke="{COCOA}" stroke-width="{SW}" stroke-linecap="round"/><path d="M925 500 C890 480 880 450 892 430 C915 440 925 470 925 500Z" fill="{CREAM}" stroke="{COCOA}" stroke-width="3" stroke-linejoin="round"/>'
b+=flower(985,300,34,CREAM,GOLD)+flower(920,382,24,PEACH,CREAM)
b+=f'<path d="M270 560 C285 500 265 450 235 410" fill="none" stroke="{COCOA}" stroke-width="{SW}" stroke-linecap="round"/>'+flower(232,385,26,GOLD,PEACH)
b+=spark(1060,200,20)+spark(150,300,18)
S['how-to-apologize-to-your-partner']=wrap(PINK,b)

# 3 overthinking: thought cloud with spiral over a calm heart, night sky
b=shadow(600,560,170)
def cloud(cx,cy):
    return (f'<g stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round" fill="{PAPER}"><circle cx="{cx-110}" cy="{cy+20}" r="62"/><circle cx="{cx-40}" cy="{cy-30}" r="78"/><circle cx="{cx+55}" cy="{cy-20}" r="70"/><circle cx="{cx+125}" cy="{cy+25}" r="55"/></g>'
            f'<rect x="{cx-110}" y="{cy+10}" width="235" height="70" fill="{PAPER}"/><path d="M{cx-112} {cy+82} H{cx+125}" stroke="{COCOA}" stroke-width="{SW}" stroke-linecap="round"/>'
            f'<path d="M{cx-171} {cy+40} V{cy+24}" stroke="none"/>')
b+=cloud(600,180)
# spiral
pts=[];
for k in range(0,300):
    t=k/300*5.2*math.pi;r=3+t*5.2
    pts.append((600-10+r*math.cos(t),180-4+r*math.sin(t)*0.85))
b+='<path d="M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pts)+f'" fill="none" stroke="{DEEP}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
b+=f'<circle cx="560" cy="318" r="17" fill="{PAPER}" stroke="{COCOA}" stroke-width="{SW}"/><circle cx="534" cy="362" r="10" fill="{PAPER}" stroke="{COCOA}" stroke-width="{SW}"/>'
# calm heart (closed eyes)
eyes=f'<path d="M34 44 q6 6 12 0 M54 44 q6 6 12 0" fill="none" stroke="{COCOA}" stroke-width="3" stroke-linecap="round"/><path d="M44 58 q6 5 12 0" fill="none" stroke="{COCOA}" stroke-width="3" stroke-linecap="round"/>'
b+=hcenter(520,470,2.1,PINK,extra=eyes)
# moon + window of night
b+=f'<path d="M930 130 a70 70 0 1 0 60 110 a58 58 0 0 1 -60 -110z" fill="{GOLD}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
b+=spark(870,300,22)+spark(1040,330,18)+spark(950,420,14)+spark(300,160,18)+spark(250,330,14)
# phone with typing dots
b+=f'<rect x="760" y="390" width="150" height="190" rx="26" fill="{CREAM}" stroke="{COCOA}" stroke-width="{SW}"/><rect x="790" y="420" width="90" height="34" rx="17" fill="{PINK}" stroke="{COCOA}" stroke-width="3"/>'
b+=''.join(f'<circle cx="{820+k*18}" cy="437" r="5" fill="{COCOA}"/>' for k in range(3))+line(795,500,865,7,COCOA,.35)+line(795,530,845,7,COCOA,.35)
S['how-to-stop-overthinking-in-a-relationship']=wrap(PEACH,b)

# 4 communication habits: two speech bubbles taking turns
b=shadow(600,570,330)
b+=f'<path d="M215 130 h400 a40 40 0 0 1 40 40 v170 a40 40 0 0 1 -40 40 h-250 l-90 70 v-70 h-60 a40 40 0 0 1 -40 -40 v-170 a40 40 0 0 1 40 -40z" fill="{PINK}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
for i,w in enumerate((290,230,160)): b+=line(255,190+i*44,255+w,9)
b+=f'<path d="M585 300 h400 a40 40 0 0 1 40 40 v150 a40 40 0 0 1 -40 40 h-60 v70 l-90 -70 h-250 a40 40 0 0 1 -40 -40 v-150 a40 40 0 0 1 40 -40z" fill="{CREAM}" stroke="{COCOA}" stroke-width="{SW}" stroke-linejoin="round"/>'
for i,w in enumerate((270,200,240)): b+=line(625,360+i*44,625+w,9,COCOA,.9)
b+=hcenter(600,262,0.62,PEACH)+hcenter(920,242,0.4,CREAM,rot=12)
b+=f'<path d="M700 70 q40 10 56 46 M720 40 q70 18 96 80" fill="none" stroke="{COCOA}" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>'
b+=spark(1070,300,22)+spark(140,520,20)+spark(1000,90,16)
S['relationship-advice-communication-habits']=wrap(GOLD,b)

# 5 fix a relationship: mended heart with patch, needle and thread
b=shadow(600,570,240)
m=hcenter(600,300,3.4,PINK)
m+=f'<defs><clipPath id="hc"><path d="{HP}" transform="translate(600 300) scale(3.4) translate(-50 -48)"/></clipPath></defs>'
m+=f'<g clip-path="url(#hc)"><path d="M610 120 L585 215 L640 265 L585 330 L640 400 L600 470" fill="none" stroke="{COCOA}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>'
m+=f'<g transform="rotate(8 650 330)"><rect x="570" y="262" width="170" height="150" rx="14" fill="{GOLD}" stroke="{COCOA}" stroke-width="{SW}"/><rect x="584" y="276" width="142" height="122" rx="8" fill="none" stroke="{COCOA}" stroke-width="3" stroke-dasharray="12 9" stroke-linecap="round"/></g></g>'
m+=hcenter(600,300,3.4,'none')
# needle + thread
m+=f'<g transform="rotate(-38 880 200)"><rect x="760" y="192" width="230" height="14" rx="7" fill="{CREAM}" stroke="{COCOA}" stroke-width="3.5"/><ellipse cx="780" cy="199" rx="9" ry="4" fill="{PINK}" stroke="{COCOA}" stroke-width="2.5"/></g>'
m+=f'<path d="M790 262 C720 330 760 250 690 340 C640 400 600 330 560 360" fill="none" stroke="{DEEP}" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>'
b+=f'<g transform="translate(600 315) scale(1.2) translate(-600 -300)">{m}</g>'
b+=spark(230,230,24)+spark(1010,430,20)+spark(300,500,16)+spark(930,110,16)
b+=hcenter(1020,230,0.5,GOLD,rot=14)+hcenter(190,420,0.45,CREAM,rot=-12)
S['how-to-fix-a-relationship']=wrap(PEACH,b)

# 6 recurring problems: loop of arrows around a heart
b=shadow(600,565,230)
def arc(a0,a1,R=190):
    x0=600+R*math.cos(math.radians(a0));y0=315+R*math.sin(math.radians(a0))
    x1=600+R*math.cos(math.radians(a1));y1=315+R*math.sin(math.radians(a1))
    return x0,y0,x1,y1
def arrow(a0,a1):
    R=190;x0,y0,x1,y1=arc(a0,a1)
    p=f'<path d="M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{COCOA}" stroke-width="22" stroke-linecap="round"/>'
    ang=a1+90  # tangent direction
    hx,hy=x1,y1
    t=math.radians(ang)
    tip=(hx+math.cos(t)*34,hy+math.sin(t)*34)
    n=math.radians(ang+90)
    l=(hx+math.cos(n)*34,hy+math.sin(n)*34);r=(hx-math.cos(n)*34,hy-math.sin(n)*34)
    return p+f'<path d="M{l[0]:.1f} {l[1]:.1f} L{tip[0]:.1f} {tip[1]:.1f} L{r[0]:.1f} {r[1]:.1f} Z" fill="{COCOA}" stroke="{COCOA}" stroke-width="10" stroke-linejoin="round"/>'
b+=f'<circle cx="600" cy="315" r="190" fill="{PAPER}" stroke="none"/>'
b+=arrow(200,330)+arrow(20,150)
b+=hcenter(600,318,2.1,PINK)
for (x,y,r,c) in ((250,170,14,CREAM),(210,215,9,PINK),(960,430,14,CREAM),(990,385,9,GOLD),(300,500,12,GOLD)):
    b+=f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{COCOA}" stroke-width="3"/>'
b+=spark(950,170,24)+spark(220,420,20)+spark(1050,300,16)
S['relationship-problems-that-keep-coming-back']=wrap(PEACH,b)

for k,v in S.items(): open(f'/root/lp/img/blog/card-{k}.svg','w').write(v)
print(len(S))
