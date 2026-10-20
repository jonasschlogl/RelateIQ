from blog_lib2 import *
S={}
def sc(name):
    def d(f): S[name]=f; return f
    return d
FL='#c9966f'; BR='#a8765c'; PLUM='#4a2d3a'; DUSK='#6b3f58'
# ============ P1
@sc('p1-1')
def _():
    bg=dotsbg(BGG,'#f0c97f')
    b=rrect(60,380,680,40,12,FL,4,6)
    # stand legs
    b+=f'<path d="M290 395 L340 250 M510 395 L460 250" stroke="{K}" stroke-width="16" stroke-linecap="round"/><path d="M290 395 L340 250 M510 395 L460 250" stroke="{BGP}" stroke-width="8" stroke-linecap="round"/>'
    # wheel
    b+=f'<circle cx="406" cy="226" r="158" fill="none" stroke="{K}" stroke-width="22"/><circle cx="400" cy="220" r="158" fill="{CREAM}" fill-opacity=".55" stroke="{K}" stroke-width="22"/><circle cx="400" cy="220" r="158" fill="none" stroke="{BGP}" stroke-width="12"/>'
    for i in range(8):
        a=math.radians(i*22.5)
        b+=f'<line x1="{400-150*math.cos(a):.1f}" y1="{220-150*math.sin(a):.1f}" x2="{400+150*math.cos(a):.1f}" y2="{220+150*math.sin(a):.1f}" stroke="{K}" stroke-width="4" opacity=".5"/>'
    b+=circ(400,220,16,GOLD)
    # running heart with legs
    b+=f'<path d="M370 318 L352 346 M430 318 L452 340" stroke="{K}" stroke-width="9" stroke-linecap="round"/><ellipse cx="346" cy="350" rx="14" ry="8" fill="{K}"/><ellipse cx="458" cy="344" rx="14" ry="8" fill="{K}"/>'
    b+=heart(335,200,1.35,ROSE,-6)
    b+=''.join(f'<line x1="{x}" y1="{y}" x2="{x-42}" y2="{y}" stroke="{K}" stroke-width="5" stroke-linecap="round"/>' for x,y in ((150,170),(120,225),(170,280)))
    b+=bolt(650,100,1.8,GOLD)+bolt(690,170,1.2,ROSE)
    return svgw(bg,b)
@sc('p1-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGO}"/>'
    b=rrect(120,50,560,360,26,CREAM,4,8)
    b+=f'<path d="M124 52 H676 a24 24 0 0 1 24 24 V120 H100 V76 a24 24 0 0 1 24 -24Z" fill="{ROSE}" stroke="{K}" stroke-width="4" transform="translate(0 0)"/><rect x="100" y="104" width="600" height="16" fill="{ROSE}"/><line x1="102" y1="120" x2="698" y2="120" stroke="{K}" stroke-width="4"/>'
    for x in (230,400,570): b+=f'<rect x="{x-9}" y="30" width="18" height="46" rx="9" fill="{GOLD}" stroke="{K}" stroke-width="4"/>'
    cols,rows=6,4
    x0,y0,dx,dy=170,160,80,60
    hearts={(2,1),(4,3)}
    for r in range(rows):
        for c in range(cols):
            cx,cy=x0+c*dx+20,y0+r*dy+22
            b+=f'<rect x="{cx-30}" y="{cy-24}" width="60" height="48" rx="10" fill="{BGB if (r+c)%2 else CREAM}" stroke="{K}" stroke-width="2.5"/>'
            if (c,r) in hearts: b+=heart(cx-17,cy-17,.34,ROSE,0,'',3,2)
            else: b+=bolt(cx,cy,1.1,GOLD if (r+c)%3 else ORG)
    b+=f'<circle cx="{x0+2*dx+20}" cy="{y0+1*dy+22}" r="36" fill="none" stroke="{DEEP}" stroke-width="5" stroke-dasharray="9 7" stroke-linecap="round"/>'
    b+=star(740,80,1.5)+star(60,350,1.3)
    return svgw(bg,b)
@sc('p1-3')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGP}"/><circle cx="650" cy="90" r="64" fill="{GOLD}" stroke="{K}" stroke-width="4"/>'
    b=cloud(610,92,.8,CREAM)
    path='M175 335 C80 140 470 20 640 190 C720 280 380 410 215 345'
    b+=f'<path d="{path}" fill="none" stroke="{K}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1 24"/>'
    b+=f'<g transform="translate(250 330) rotate(-22) scale(1.5)">'+poly('M-100 -30 C-40 -80 60 -62 108 4 L78 32 C34 -22 -30 -24 -66 14 Z',GOLD,4,6)+'</g>'
    b+=cloud(150,350,.9,BGB)+bolt(150,375,2,ROSE)
    b+=heart(540,300,.9,ORG,10)+star(330,80,1.3)+star(740,320,1.2)
    return svgw(bg,b)
# ============ P2
@sc('p2-1')
def _():
    bg=dotsbg(BGP,'#ecaebb',40,3)
    patches=[(GOLD,'M0 0 H50 V45 H0Z'),(ORG,'M50 0 H100 V45 H50Z'),('#f6e6cf','M0 45 H35 V70 H0Z'),(ROSE,'M35 45 H70 V95 H35Z'),(GOLD,'M70 45 H100 V95 H70Z'),(ORG,'M0 70 H35 V100 H0Z')]
    sc_=3.7
    clip=f'<clipPath id="hc"><path d="{HEART}"/></clipPath>'
    inner=''.join(f'<path d="{d}" fill="{c}"/>' for c,d in patches)
    inner+=''.join(f'<path d="{d}" fill="none" stroke="{K}" stroke-width=".9" stroke-dasharray="2.4 2.4"/>' for c,d in patches)
    b=clip+f'<g transform="translate(215 40) scale({sc_})"><path d="{HEART}" transform="translate(2 2)" fill="{K}"/><g clip-path="url(#hc)">{inner}</g><path d="{HEART}" fill="none" stroke="{K}" stroke-width="1.2" stroke-linejoin="round"/></g>'
    # needle + thread
    b+=f'<path d="M520 120 C560 80 640 90 650 150 C660 210 580 240 600 300" fill="none" stroke="{CREAM}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 11"/>'
    b+=f'<g transform="translate(470 100) rotate(-35)"><rect x="-4" y="-60" width="8" height="120" rx="4" fill="{K}" transform="translate(4 4)"/><rect x="-4" y="-60" width="8" height="120" rx="4" fill="{CREAM}" stroke="{K}" stroke-width="3"/><ellipse cx="0" cy="-44" rx="2.4" ry="9" fill="{K}"/></g>'
    b+=heart(80,320,.8,GOLD,-12)+star(700,370,1.3)+star(100,90,1.3)
    return svgw(bg,b)
@sc('p2-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGG}"/>'+f'<rect y="360" width="{W}" height="90" fill="{FL}"/><line x1="0" y1="360" x2="{W}" y2="360" stroke="{K}" stroke-width="4"/>'
    b=''
    # tools behind the box
    b+=f'<g transform="translate(300 232) rotate(-18)">'+rrect(-14,-140,28,170,8,GOLD,4,5)+f'<rect x="-6" y="-190" width="12" height="52" fill="{CREAM}" stroke="{K}" stroke-width="4"/></g>'
    b+=f'<g transform="translate(500 224) rotate(14)">'+rrect(-10,-160,20,190,6,CREAM,4,5)+poly('M-46 -170 h92 v34 h-92Z',ROSE,4,5)+'</g>'
    b+=f'<g transform="translate(400 244)">'+poly('M-6 -150 h12 v140 h-12Z',CREAM,4,5)+heart(-38,-215,.76,ROSE,0,'',4,5)+'</g>'
    # box
    b+=rrect(160,230,480,150,22,ORG,4,8)
    b+=f'<rect x="160" y="230" width="480" height="40" rx="18" fill="{ROSE}" stroke="{K}" stroke-width="4"/>'
    b+=f'<path d="M330 230 v-26 h140 v26" fill="none" stroke="{K}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'
    b+=f'<rect x="370" y="250" width="60" height="40" rx="8" fill="{GOLD}" stroke="{K}" stroke-width="4"/>'
    b+=heart(386,296,.28,ROSE,0,'',3,2)
    b+=star(90,90,1.6)+star(720,100,1.3)+star(700,300,1)
    return svgw(bg,b)
@sc('p2-3')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGO}"/><circle cx="400" cy="150" r="95" fill="{GOLD}" stroke="{K}" stroke-width="4"/>'
    b=''
    b+=f'<path d="M0 360 Q100 330 200 360 T400 360 T600 360 T800 360 V450 H0Z" fill="{ROSE}" stroke="{K}" stroke-width="4"/>'
    b+=poly('M-10 190 H220 V400 H-10Z',FL,4,7)+poly('M580 190 H810 V400 H580Z',FL,4,7)
    b+=f'<rect x="-10" y="190" width="230" height="30" fill="{BR}" stroke="{K}" stroke-width="4"/><rect x="580" y="190" width="230" height="30" fill="{BR}" stroke="{K}" stroke-width="4"/>'
    # planks bridge
    xs=[230,268,306,344]; xr=[456,494,532,570]
    for x in xs+xr: b+=rrect(x,200,32,16,4,GOLD,3,3)
    for x in (382,420): b+=f'<rect x="{x}" y="200" width="32" height="16" rx="4" fill="none" stroke="{K}" stroke-width="3" stroke-dasharray="6 6"/>'
    b+=f'<path d="M220 196 Q400 270 580 196" fill="none" stroke="{K}" stroke-width="5"/><path d="M220 140 L220 196 M580 140 L580 196" stroke="{K}" stroke-width="5"/><path d="M220 140 Q400 210 580 140" fill="none" stroke="{K}" stroke-width="5"/>'
    # flags
    b+=f'<line x1="120" y1="190" x2="120" y2="90" stroke="{K}" stroke-width="6" stroke-linecap="round"/>'+heart(120,86,.5,GOLD,0,'',3,3)
    b+=f'<line x1="680" y1="190" x2="680" y2="90" stroke="{K}" stroke-width="6" stroke-linecap="round"/>'+heart(630,86,.5,BGP,0,'',3,3)
    b+=cloud(170,60,.7,CREAM)+cloud(650,50,.6,CREAM)
    return svgw(bg,b)
# ============ P3
def mug(x,y,fill,side):
    h=f'<path d="M{x+(86 if side=="r" else -86)} {y+20} h{18 if side=="r" else -18} q{14 if side=="r" else -14} 0 {14 if side=="r" else -14} 30 q0 30 {-14 if side=="r" else 14} 30 h{-16 if side=="r" else 16}" fill="none" stroke="{K}" stroke-width="22" stroke-linecap="round"/><path d="M{x+(86 if side=="r" else -86)} {y+20} h{18 if side=="r" else -18} q{14 if side=="r" else -14} 0 {14 if side=="r" else -14} 30 q0 30 {-14 if side=="r" else 14} 30 h{-16 if side=="r" else 16}" fill="none" stroke="{fill}" stroke-width="10" stroke-linecap="round"/>'
    return h+poly(f'M{x-88} {y} H{x+88} V{y+70} Q{x+88} {y+130} {x+40} {y+130} H{x-40} Q{x-88} {y+130} {x-88} {y+70}Z',fill,4,6)+f'<ellipse cx="{x}" cy="{y}" rx="88" ry="14" fill="{K}"/><ellipse cx="{x}" cy="{y+1}" rx="80" ry="9" fill="#7b4a36"/>'
@sc('p3-1')
def _():
    bg=stripesbg(BGO,'#f4bf9a',50)
    b=f'<rect y="340" width="{W}" height="110" fill="{FL}"/><line x1="0" y1="340" x2="{W}" y2="340" stroke="{K}" stroke-width="4"/>'
    b+=mug(230,225,GOLD,'l')+mug(570,225,BGP,'r')
    sm=lambda x,s: f'<path d="M{x} 190 C{x+s*30} 150 {x-s*30} 120 {x+s*10} 80" fill="none" stroke="{CREAM}" stroke-width="9" stroke-linecap="round"/>'
    b+=sm(270,1)+sm(530,-1)
    b+=heart(350,60,1.0,ROSE,0)
    b+=star(130,110,1.4)+star(690,120,1.4)+star(400,300,1)
    return svgw(bg,b)
@sc('p3-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGP}"/>'
    b=cloud(180,80,.8,CREAM)+cloud(620,110,.7,CREAM)
    def can(x,y,col,flip):
        return (poly(f'M{x-62} {y-90} V{y+80} a62 20 0 0 0 124 0 V{y-90}Z',col,4,7)
                +f'<rect x="{x-62}" y="{y-30}" width="124" height="56" fill="{CREAM}" stroke="{K}" stroke-width="4"/>'
                +heart(x-17,y-26,.34,ROSE,0,'',3,0)
                +f'<ellipse cx="{x}" cy="{y-90}" rx="62" ry="20" fill="{CREAM}" stroke="{K}" stroke-width="4"/><ellipse cx="{x}" cy="{y-90}" rx="40" ry="11" fill="#7b4a36" stroke="{K}" stroke-width="3"/>')
    string='M120 150 C220 330 330 200 400 250 S540 330 680 150'
    b+=f'<path d="{string}" fill="none" stroke="{K}" stroke-width="12" stroke-linecap="round" transform="translate(4 5)"/><path d="{string}" fill="none" stroke="{CREAM}" stroke-width="6" stroke-linecap="round"/><path d="{string}" fill="none" stroke="{K}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 8"/>'
    b+=can(100,265,GOLD,False)+can(700,265,ORG,True)
    b+=heart(372,262,.62,ROSE,-8)
    b+=f'<g stroke="{K}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M200 165 q16 -16 0 -32"/><path d="M225 175 q22 -22 0 -44"/></g>'
    b+=f'<g stroke="{K}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M600 165 q-16 -16 0 -32"/><path d="M575 175 q-22 -22 0 -44"/></g>'
    b+=f'<rect y="395" width="{W}" height="55" fill="{FL}"/><line x1="0" y1="395" x2="{W}" y2="395" stroke="{K}" stroke-width="4"/>'
    return svgw(bg,b)
@sc('p3-3')
def _():
    bg=dotsbg(BGG,'#f0c97f',38,3.2)
    # left piece with tab, right piece with notch
    L='M90 100 H390 a0 0 0 0 1 0 0 V190 a36 36 0 0 1 0 72 V340 H90 Z'
    L='M90 90 H380 V192 A36 36 0 1 1 380 264 V350 H90 Z'
    R='M400 90 H710 V350 H400 V267 A44 44 0 0 0 400 189 Z'
    b=poly(L,BGP,4,8)+poly(R,ORG,4,8)
    b+=heart(190,150,1.0,ROSE,-6)+dots(570,225,36,10)+bar(140,280,150)+bar(470,300,120)
    b+=star(740,60,1.5)+star(60,400,1.3)+star(420,400,1)
    return svgw(bg,b)
# ============ P4
@sc('p4-1')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGB}"/><path d="M0 380 Q200 330 400 370 T800 350 V450 H0Z" fill="{BGO}" stroke="{K}" stroke-width="4"/>'
    b=rrect(380,330,40,90,8,FL,4,6)+circ(400,330,12,GOLD)
    # balloons: (x,y,color,string path)
    def balloon(x,y,col,sc_,rot,string):
        s=f'<path d="{string}" fill="none" stroke="{K}" stroke-width="4.5" stroke-linecap="round"/>'
        return s+heart(x-50*sc_,y-44*sc_,sc_,col,rot,'',4,5)
    b+=balloon(330,205,PINK,1.15,-6,'M330 270 C345 300 395 300 398 322')    # clingy: short
    b+=balloon(660,70,ORG,1.15,10,'M660 130 C640 200 700 250 520 300 S420 320 404 326')  # far, long
    b+=balloon(480,170,GOLD,1.15,4,'M480 235 C470 270 420 290 406 322')   # secure: calm
    b+=balloon(150,110,ROSE,1.15,-10,'M150 175 l30 30 l-30 30 l40 30 l-20 25 l70 25 l30 -30 l60 10')  # chaotic zigzag
    b+=star(740,380,1.3)+star(60,300,1.3)+cloud(560,60,.6,CREAM)
    return svgw(bg,b)
@sc('p4-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{DUSK}"/>'
    for (x,y,s) in ((90,60,1.3),(200,140,1),(690,70,1.5),(740,200,1),(560,40,1)): bg+=star(x,y,s)
    b=f'<path d="M400 190 L-100 130 L-100 260Z" fill="{GOLD}" opacity=".35"/><path d="M400 190 L900 130 L900 260Z" fill="{GOLD}" opacity=".35"/>'
    b+=f'<path d="M0 360 Q100 340 200 360 T400 360 T600 360 T800 360 V450 H0Z" fill="{ROSE}" stroke="{K}" stroke-width="4"/><path d="M0 400 Q100 380 200 400 T400 400 T600 400 T800 400 V450 H0Z" fill="{DEEP}" stroke="{K}" stroke-width="4"/>'
    b+=poly('M270 400 L300 330 L330 300 H470 L500 330 L530 400Z',BR,4,6)
    b+=poly('M355 300 L370 120 H430 L445 300Z',CREAM,4,6)
    b+=f'<path d="M362 220 H438 L433 160 H367Z" fill="{BGP}" stroke="{K}" stroke-width="3"/>'
    b+=poly('M360 120 H440 V90 H360Z',ORG,4,5)+rrect(370,52,60,40,8,GOLD,4,4)+heart(382,46,.35,ROSE,0,'',3,2)+poly('M358 54 L400 22 L442 54Z',ROSE,4,5)
    b+=poly('M640 380 h90 l-14 24 h-62z',GOLD,4,5)+f'<line x1="685" y1="380" x2="685" y2="318" stroke="{K}" stroke-width="5"/>'+heart(662,318,.35,BGP,0,'',3,3)
    return svgw(bg,b)
@sc('p4-3')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{PLUM}"/>'
    for (x,y,s) in ((70,60,1.3),(730,70,1.5),(120,380,1),(700,390,1.3),(400,30,1),(250,420,.9),(560,425,1)): bg+=star(x,y,s)
    b=''
    for r in (95,150,205): b+=f'<circle cx="400" cy="225" r="{r}" fill="none" stroke="{CREAM}" stroke-width="3" stroke-dasharray="4 10" stroke-linecap="round" opacity=".7"/>'
    b+=heart(335,160,1.3,GOLD,0)+'<circle cx="400" cy="225" r="0"/>'
    b+=heart(470,95,.5,PINK,8)+heart(268,240,.42,ORG,-10)+heart(605,288,.4,BGP,10)
    b+=heart(180,100,.36,ROSE,-8)
    b+=f'<path d="M470 100 C560 90 640 150 660 215" fill="none" stroke="{CREAM}" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round" opacity=".6"/>'
    return svgw(bg,b)
# ============ P5
@sc('p5-1')
def _():
    bg=stripesbg(BGO,'#f4bf9a',50)
    b=''
    cols=[(PINK,260,120,-8),(GOLD,350,80,0),(ROSE,440,110,6),(CREAM,520,150,12),(BGP,190,160,-14)]
    for c,x,y,r in cols:
        b+=f'<path d="M{x} {y} Q{(x+400)/2} {(y+300)/2+20} 400 330" stroke="{K}" stroke-width="9" fill="none" stroke-linecap="round"/>'
    for i,(c,x,y,r) in enumerate(cols):
        b+=flower(x,y,46,c,GOLD if c!=GOLD else ROSE,6,r*3)
    b+=poly('M290 250 L510 250 L400 410Z',CREAM,4,7)+poly('M290 250 L400 290 L510 250 L400 410Z',BGP,4,0)
    b+=heart(366,315,.55,ROSE,0,'',3,3)
    b+=star(110,110,1.5)+star(690,100,1.4)+star(660,360,1.2)+star(120,350,1.1)
    return svgw(bg,b)
@sc('p5-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGB}"/>'
    b=cloud(150,90,1,CREAM)+cloud(640,70,.8,CREAM)+cloud(690,340,1,CREAM)+cloud(120,370,.8,CREAM)
    path='M90 370 C200 380 250 250 360 260 S470 190 560 170'
    b+=f'<path d="{path}" fill="none" stroke="{K}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 14"/>'
    for (x,y,r) in ((150,372,-10),(270,300,14),(390,250,-6)): b+=heart(x-14,y-14,.28,ROSE,r,'',2.5,2)
    b+=f'<g transform="translate(580 170) rotate(-14) scale(1.35)">'+poly('M110 0 L-130 -64 L-56 8Z',GOLD,4,6)+poly('M110 0 L-56 8 L-130 60 Z',CREAM,4,6)+poly('M110 0 L-56 8 L-30 -14Z',ORG,3,0)+heart(-96,-34,.3,ROSE,0,'',2.5,0)+'</g>'
    b+=star(70,200,1.3)+star(430,380,1.2)+star(740,260,1)
    return svgw(bg,b)
@sc('p5-3')
def _():
    bg=stripesbg(BGP,'#ecaebb',34)
    b=f'<rect y="360" width="{W}" height="90" fill="{FL}"/><line x1="0" y1="360" x2="{W}" y2="360" stroke="{K}" stroke-width="4"/>'
    b+=f'<g transform="translate(400 190) rotate(-4)">'+rrect(-150,-140,300,280,10,'#fbe7a8',4,8)+f'<g transform="translate(-34 -24)">'+heart(-40,-50,1.0,ROSE,0,'',4,4)+'</g>'
    b+=f'<path d="M-100 80 H100 M-100 104 H40" stroke="{K}" stroke-width="5" stroke-linecap="round" opacity=".55"/>'
    b+=f'<rect x="-52" y="-156" width="104" height="34" fill="{ORG}" fill-opacity=".85" stroke="{K}" stroke-width="3" transform="rotate(3)"/></g>'
    b+=circ(120,330,38,GOLD)+heart(100,310,.4,ROSE,0,'',3,2)
    b+=f'<g transform="translate(650 330)">'+poly('M-70 0 H70 L56 30 H-56Z',CREAM,4,5)+'<circle cx="-18" cy="-6" r="14" fill="#7b4a36" stroke="#3b2218" stroke-width="3"/><circle cx="18" cy="-8" r="14" fill="#7b4a36" stroke="#3b2218" stroke-width="3"/></g>'
    b+=star(90,80,1.4)+star(710,90,1.4)
    return svgw(bg,b)
# ============ P6
@sc('p6-1')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{PLUM}"/>'
    b=rrect(480,50,240,230,22,DUSK,4,7)
    b+=f'<line x1="600" y1="52" x2="600" y2="278" stroke="{K}" stroke-width="4"/><line x1="482" y1="165" x2="718" y2="165" stroke="{K}" stroke-width="4"/>'
    b+=f'<g transform="translate(540 120)"><path d="M0 -34 A34 34 0 1 0 34 14 A27 27 0 1 1 0 -34Z" fill="{GOLD}" stroke="{K}" stroke-width="3"/></g>'
    b+=star(660,100,1)+star(520,230,.8)+star(670,230,1)
    # bed
    b+=rrect(60,330,680,70,16,FL,4,6)+rrect(60,300,120,100,14,BR,4,6)
    b+=rrect(200,270,200,70,30,CREAM,4,6)
    b+=rrect(160,320,580,60,20,ROSE,4,6)
    for i in range(7): b+=f'<circle cx="{200+i*80}" cy="380" r="22" fill="{ROSE}" stroke="{K}" stroke-width="4"/>'
    # phone glow
    b+=f'<circle cx="290" cy="262" r="58" fill="{GOLD}" opacity=".25"/>'+rrect(268,226,44,70,8,CREAM,3,4,'rotate(-14 290 262)')
    # thought chain
    b+=circ(250,200,8,CREAM,3,3)+circ(215,160,12,CREAM,3,3)
    b+=union([('c',100,100,40),('c',160,80,50),('c',230,100,42),('r',80,100,180,38,19)],CREAM,3.5,5)
    b+=f'<path d="M160 100 m0 0 a8 8 0 1 1 16 0 a16 16 0 1 1 -32 0 a24 24 0 1 1 48 0 a32 32 0 1 1 -64 0" fill="none" stroke="{K}" stroke-width="4" stroke-linecap="round"/>'
    return svgw(bg,b)
@sc('p6-2')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGG}"/><circle cx="90" cy="110" r="62" fill="{ORG}" stroke="{K}" stroke-width="4"/>'
    b=f'<rect y="350" width="{W}" height="100" fill="{FL}"/><line x1="0" y1="350" x2="{W}" y2="350" stroke="{K}" stroke-width="4"/>'
    # giant shadow mountain
    b+=f'<path d="M230 352 L430 340 L520 170 L560 220 L630 90 L700 230 L760 190 L800 352Z" fill="{K}" opacity=".32"/>'
    b+=heart(196,304,.55,ROSE,0,'',4,4)
    b+=f'<path d="M222 292 C260 230 400 200 500 150" fill="none" stroke="{K}" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>'
    b+=star(330,90,1.3)+star(430,60,1)+cloud(520,70,.7,CREAM)
    return svgw(bg,b)
@sc('p6-3')
def _():
    bg=f'<rect width="{W}" height="{H}" fill="{BGB}"/><circle cx="400" cy="205" r="140" fill="{ORG}"/>'
    b=f'<rect y="320" width="{W}" height="130" fill="{BGP}"/><line x1="0" y1="320" x2="{W}" y2="320" stroke="{K}" stroke-width="4"/>'
    for y,w in ((350,300),(385,420),(420,540)): b+=f'<path d="M{400-w/2} {y} q{w/4} -10 {w/2} 0 t{w/2} 0" fill="none" stroke="{K}" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>'
    b+=ell(400,332,170,26,'#c98a6a',4,5)
    b+=ell(400,300,125,40,GOLD,4,5)+ell(400,240,95,34,BGP,4,5)+ell(400,190,66,28,ORG,4,5)
    b+=heart(364,98,.72,ROSE,0)
    b+=star(130,90,1.4)+star(690,90,1.4)+star(110,260,1)
    return svgw(bg,b)
