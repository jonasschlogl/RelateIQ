from lib import *
S={}
def sc(name,bg,cl):
    def deco(f):
        S[name]=(f,bg,cl); return f
    return deco
# ---------- P1 problems that keep coming back
@sc('p1-1',BGG,(700,420,330,-14,.5,'k'))
def _():
    b=arc(400,225,118,-60,235,PINK,18)
    b+=heart(352,176,1.0,ORG,0,'',4,5)
    b+=bubble(50,50,190,96,CREAM,'l',dots(145,98,26,8))
    b+=bubble(560,290,190,96,BGP,'r',bar(600,320,100)+bar(600,344,66))
    b+=star(650,90,1.4)+star(120,330,1.1)+star(270,400,.9,GOLD)
    return b
@sc('p1-2',BGP,(60,40,320,20,.5,'k'))
def _():
    zig=lambda x,y,c: f'<path d="M{x} {y} l16 -18 l16 36 l16 -36 l16 36 l16 -18" stroke="{K}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b=bubble(70,90,280,130,GOLD,'l',zig(130,155,K))
    b+=bubble(450,200,280,130,ORG,'r',zig(510,265,K))
    b+=arc(400,250,36,-40,230,CREAM,10)
    b+=heart(640,50,.9,ROSE,10)+star(110,350,1.2)+star(380,60,1)
    return b
@sc('p1-3',BGO,(120,430,340,10,.5,'k'))
def _():
    b=arc(300,225,105,-20,250,GOLD,18,head=False)
    b+=line('M268 118 C340 60 470 90 560 160',PINK,16)
    b+=f'<polygon points="590,180 545,200 555,140" transform="translate(5 5)" fill="{K}"/><polygon points="590,180 545,200 555,140" fill="{PINK}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
    b+=heart(610,200,1.7,ROSE,8)
    b+=star(110,90,1.3)+star(700,70,1)+star(430,390,1,GOLD)
    return b
# ---------- P2 fix a relationship
L='M50 21 C46 13 38 8 29 8 C17 8 6 16 6 30 C6 46 20 64 50 88 L44 72 L55 60 L45 46 L55 34 Z'
R='M50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 L44 72 L55 60 L45 46 L55 34 Z'
def plaster(cx,cy,rot=-38,s=1):
    return (f'<g transform="translate({cx} {cy}) rotate({rot}) scale({s})"><rect x="-100" y="-26" width="200" height="52" rx="26" transform="translate(5 5)" fill="{K}"/>'
        f'<rect x="-100" y="-26" width="200" height="52" rx="26" fill="{ORG}" stroke="{K}" stroke-width="4"/><rect x="-34" y="-26" width="68" height="52" fill="{CREAM}" stroke="{K}" stroke-width="4"/>'
        +''.join(f'<circle cx="{x}" cy="{y}" r="3.3" fill="{K}"/>' for x in (-14,0,14) for y in (-9,9))+'</g>')
@sc('p2-1',BGP,(720,40,330,30,.5,'k'))
def _():
    sc_=3.9
    b=st(L,GOLD,f'translate(215 40) rotate(-7 200 200) translate(-4 0) scale({sc_})',4,6,sc_)
    b+=st(R,ORG,f'translate(215 40) rotate(7 200 200) translate(4 0) scale({sc_})',4,6,sc_)
    b+=plaster(400,225)
    b+=heart(80,60,.9,ROSE,-10)+star(700,330,1.3)+star(110,370,1.1)
    return b
@sc('p2-2',BGG,(80,430,330,-8,.5,'k'))
def _():
    b=''
    for i,(x,h,c) in enumerate(((120,90,BGP),(290,170,ORG),(460,250,CREAM))):
        b+=rrect(x,400-h,150,h,18,c,4,6)
        b+=f'<text x="{x+75}" y="{400-h/2+14}" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="48" fill="{K}">{i+1}</text>'
    b+=heart(500,60,1.4,ROSE,8)+star(650,300,1.4)+star(100,120,1.1)+star(700,90,.9,CREAM)
    return b
@sc('p2-3',BGO,(700,430,320,-18,.5,'k'))
def _():
    b=heart(110,110,2.4,GOLD,-6)+heart(450,110,2.4,BGP,6)
    b+=line('M335 215 H425',CREAM,12)
    b+=star(390,70,1.3)+star(400,400,1.1)
    return b
# ---------- P3 communication habits
@sc('p3-1',BGO,(60,420,330,12,.5,'k'))
def _():
    b=bubble(70,60,300,130,GOLD,'l',heart(190,78,.8,ROSE,0,'',4,5))
    b+=bubble(430,190,300,130,BGP,'r',dots(580,255,38,10))
    b+=star(710,80,1.3)+star(90,300,1.2)+star(380,380,1,GOLD)
    return b
@sc('p3-2',BGP,(740,50,320,18,.5,'k'))
def _():
    ck=f'<path d="M-24 2 L-8 20 L26 -18" stroke="{K}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b=bubble(70,70,260,120,GOLD,'l',f'<g transform="translate(200 130)">{ck}</g>')
    b+=bubble(470,160,260,120,CREAM,'r',f'<g transform="translate(600 220)"><path d="M0 0 m-28 0 q14 -26 28 0 t28 0" stroke="{K}" stroke-width="9" fill="none" stroke-linecap="round"/></g>')
    b+=heart(350,320,1.1,ROSE,-6)+star(700,50,1.2)+star(90,320,1.1)
    return b
@sc('p3-3',BGG,(60,40,330,0,.5,'k'))
def _():
    b=bubble(180,70,440,200,BGP,'l',f'<path d="M250 170 q30 -50 60 0 t60 0 t60 0 t60 0" stroke="{K}" stroke-width="12" fill="none" stroke-linecap="round"/>')
    b+=heart(640,300,1.3,ROSE,10)+heart(90,310,.8,ORG,-12)+star(700,80,1.3)+star(140,70,1.1)+star(450,390,1,CREAM)
    return b
# ---------- P4 attachment styles
@sc('p4-1',BGB,(120,60,300,10,.55,'k'))
def _():
    b=''
    cfg=((0,GOLD),(90,BGP),(180,ORG),(270,ROSE))
    for rot,col in cfg:
        t=f'translate(400 225) rotate({rot}) translate(0 -26) scale(1.55) translate(-50 -88)'
        b+=f'<g transform="translate(6 6)"><path d="{HEART}" transform="{t}" fill="{K}"/></g>'
    for rot,col in cfg:
        t=f'translate(400 225) rotate({rot}) translate(0 -26) scale(1.55) translate(-50 -88)'
        b+=f'<path d="{HEART}" transform="{t}" fill="{col}" stroke="{K}" stroke-width="2.6" stroke-linejoin="round"/>'
    b+=star(160,90,1.4)+star(660,340,1.5)+star(690,80,1)+star(130,370,1)
    return b
@sc('p4-2',BGP,(700,430,320,-10,.5,'k'))
def _():
    b=''
    for x in (60,290,520):
        b+=rrect(x,70,220,300,26,CREAM,4,6)
    # tight / far / comfortable
    b+=heart(80,170,.95,GOLD,-6)+heart(156,200,.95,ORG,6)
    b+=heart(305,115,.75,GOLD,-8)+heart(400,255,.75,ORG,8)
    b+=heart(538,180,.8,GOLD,-6)+heart(608,180,.8,ORG,6)
    b+=star(680,50,1.2)+star(100,410,1.1)+star(410,415,1)
    return b
@sc('p4-3',BGG,(60,420,330,16,.5,'k'))
def _():
    house='M0 -90 L110 -10 L110 100 L-110 100 L-110 -10 Z'
    b=st(house,CREAM,'translate(400 200) scale(1.25)',4,6,1.25)
    b+=f'<path d="M-130 -4 L0 -104 L130 -4" transform="translate(406 206) scale(1.25)" fill="none" stroke="{K}" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/><path d="M-130 -4 L0 -104 L130 -4" transform="translate(400 200) scale(1.25)" fill="none" stroke="{K}" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/><path d="M-130 -4 L0 -104 L130 -4" transform="translate(400 200) scale(1.25)" fill="none" stroke="{BGP}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>'
    b+=heart(358,240,1.25,ROSE,0,'',4,5)
    b+=star(130,110,1.4)+star(690,110,1.2)+star(620,360,1)+star(170,350,1,CREAM)
    return b
# ---------- P5 apologize
@sc('p5-1',BGO,(70,50,330,-10,.5,'k'))
def _():
    b=heart(230,30,2.6,ROSE,-8)+heart(430,80,1.5,GOLD,12)
    b+=rrect(200,215,400,200,26,CREAM,4,6)
    b+=f'<path d="M206 225 L400 340 L594 225" fill="none" stroke="{K}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M208 405 L340 310 M592 405 L460 310" fill="none" stroke="{K}" stroke-width="4" stroke-linecap="round"/>'
    b+=heart(362,295,.9,GOLD,0,'',4,5)+star(120,300,1.3)+star(690,120,1.2)
    return b
@sc('p5-2',BGG,(720,420,330,20,.5,'k'))
def _():
    b=line('M120 340 C250 300 430 230 640 110',K,6)
    for i,(x,y,r) in enumerate(((190,310,-30),(270,278,25),(345,245,-30),(425,208,25),(505,170,-30),(580,128,25))):
        col=BGP if i%2==0 else ORG
        b+=f'<g transform="translate({x} {y}) rotate({r})"><ellipse cx="0" cy="-32" rx="21" ry="42" transform="translate(4 4)" fill="{K}"/><ellipse cx="0" cy="-32" rx="21" ry="42" fill="{col}" stroke="{K}" stroke-width="4"/></g>'
    b+=heart(630,70,1.2,ROSE,12)+star(120,150,1.4)+star(300,390,1.1)+star(700,360,1)
    return b
@sc('p5-3',BGP,(60,60,330,0,.5,'k'))
def _():
    b=heart(90,140,2.4,GOLD,-6)+heart(480,140,2.4,ORG,6)
    b+=heart(355,160,1.0,ROSE,0)+arc(400,255,120,-150,-30,CREAM,10)
    b+=star(400,350,1.3)+star(700,60,1.1)+star(120,60,1.2)
    return b
# ---------- P6 overthinking
def spiral(cx,cy,turns,r0,r1,col,sw=14):
    pts=[]
    n=int(turns*40)
    for i in range(n+1):
        t=i/n; a=t*turns*2*math.pi; r=r0+(r1-r0)*t
        pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pts)
    return line(d,col,sw)
@sc('p6-1',BGG,(700,60,330,10,.5,'k'))
def _():
    sh=[('c',250,230,70),('c',330,170,85),('c',430,160,80),('c',520,200,70),('c',500,270,60),('c',330,270,64),('r',260,230,260,66,33)]
    b=union(sh,CREAM,4,6)
    b+=spiral(395,225,2,4,62,K,6)
    b+=f'<circle cx="215" cy="345" r="16" fill="{K}" transform="translate(5 5)"/><circle cx="215" cy="345" r="16" fill="{CREAM}" stroke="{K}" stroke-width="4"/><circle cx="170" cy="390" r="9" fill="{K}" transform="translate(4 4)"/><circle cx="170" cy="390" r="9" fill="{CREAM}" stroke="{K}" stroke-width="3"/>'
    b+=heart(560,300,1.1,ROSE,8)+star(660,90,1.3)+star(120,90,1.1)
    return b
@sc('p6-2',BGB,(60,430,330,-12,.55,'k'))
def _():
    b=f'<circle cx="400" cy="230" r="118" fill="{K}" transform="translate(7 7)"/><circle cx="400" cy="230" r="118" fill="{CREAM}" stroke="{K}" stroke-width="5"/>'
    for i in range(12):
        a=math.radians(i*30-90); r1,r2=96,(84 if i%3==0 else 90)
        b+=f'<line x1="{400+r1*math.cos(a):.1f}" y1="{230+r1*math.sin(a):.1f}" x2="{400+r2*math.cos(a):.1f}" y2="{230+r2*math.sin(a):.1f}" stroke="{K}" stroke-width="{5 if i%3==0 else 3}" stroke-linecap="round"/>'
    b+=f'<line x1="400" y1="230" x2="400" y2="158" stroke="{K}" stroke-width="8" stroke-linecap="round"/><line x1="400" y1="230" x2="450" y2="266" stroke="{K}" stroke-width="8" stroke-linecap="round"/><circle cx="400" cy="230" r="9" fill="{ROSE}" stroke="{K}" stroke-width="3"/>'
    # moon
    b+=f'<g transform="translate(610 120)"><path d="M0 -50 A50 50 0 1 0 50 20 A40 40 0 1 1 0 -50 Z" transform="translate(5 5)" fill="{K}"/><path d="M0 -50 A50 50 0 1 0 50 20 A40 40 0 1 1 0 -50 Z" fill="{GOLD}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/></g>'
    b+=star(670,250,1.5)+star(150,110,1.4)+star(130,330,1)+star(560,380,1.1,GOLD)+heart(160,200,.7,BGP,-8)
    return b
@sc('p6-3',BGP,(740,420,320,14,.5,'k'))
def _():
    pts=[]
    for i in range(0,201):
        t=i/200; a=(1-t)*3.2*2*math.pi; r=60*(1-t)+4
        x=190+t*370+ (1-t)*0; y=230+ r*math.sin(a)*0.9
        pts.append((x,y))
    d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pts)
    b=line(d,GOLD,14)
    b+=heart(555,205,1.1,ROSE,6)+star(120,90,1.4)+star(690,330,1.3)+star(330,370,1,CREAM)
    return b
