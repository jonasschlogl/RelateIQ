import sys, math, random; sys.path.insert(0,'/root/lp')
from gen_blog2 import *

def check(x, y, r=26):
    return f'<g transform="translate({x} {y})"><circle r="{r}" fill="#f2c777"/><path d="M{-r*.4:.1f} {r*.03:.1f} L{-r*.1:.1f} {r*.34:.1f} L{r*.44:.1f} {-r*.3:.1f}" stroke="#3b1f10" stroke-width="{r*.22:.1f}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
def spikes(cx, cy, r1, r2, n, fill):
    pts=[]
    for i in range(n*2):
        a=i/(n*2)*2*math.pi; r=r1 if i%2==0 else r2
        pts.append(f'{cx+r*math.cos(a):.1f} {cy+r*math.sin(a):.1f}')
    return f'<path d="M{" L".join(pts)}Z" fill="{fill}" stroke="{fill}" stroke-width="4" stroke-linejoin="round"/>'
def loop(cx, cy, rx, ry, col='#e5718a', sw=9, gap=40, start=-70):
    a0=math.radians(start+gap/2); a1=math.radians(start+360-gap/2)
    x0,y0=cx+rx*math.cos(a0),cy+ry*math.sin(a0); x1,y1=cx+rx*math.cos(a1),cy+ry*math.sin(a1)
    o=f'<path d="M{x0:.1f} {y0:.1f} A{rx} {ry} 0 1 1 {x1:.1f} {y1:.1f}" stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>'
    ang=math.atan2(ry*math.cos(a1),-rx*math.sin(a1))
    tip=(x1+22*math.cos(ang),y1+22*math.sin(ang)); l=(x1+16*math.cos(ang+2.3),y1+16*math.sin(ang+2.3)); r=(x1+16*math.cos(ang-2.3),y1+16*math.sin(ang-2.3))
    return o+f'<path d="M{tip[0]:.1f} {tip[1]:.1f} L{l[0]:.1f} {l[1]:.1f} L{r[0]:.1f} {r[1]:.1f}Z" fill="{col}" stroke="{col}" stroke-width="3" stroke-linejoin="round"/>'

# ============ C: fix a relationship
@sc(f'{Cc}-1')
def _():
    u='c1'; b=''
    b += window_arch(90, 40, 120, 200, u, sky=('#1a1030','#4e2250','#d98a6a'), seed=14) + frame_pic(580, 70, 90, 120, '#f2c777', '#e5718a', 'c1p') + frame_pic(690, 100, 60, 80, '#8a4a78', '#e5718a', 'c1q')
    b += floor(352) + rug(400, 410, 560, 50, '#5a2850')
    b += lamp(380, 80, 220, u, glow_r=120)
    b += sofa(120, 236, 560, '#8a3a5c', u, 112)
    b += pillow(140, 262, 54, '#f2c777', -6) + pillow(606, 262, 54, '#f8b8c0', 6)
    b += sitting(228, 322, 1.3, facing=1, skin=1, hair=0, style='short', top='gold', bottom='plum', la=((12,26),(32,38)), ra=((-12,26),(-32,38)), tilt=10)
    b += sitting(574, 322, 1.3, facing=-1, skin=0, hair=1, style='long', top='cream', bottom='deep', la=((12,26),(32,38)), ra=((-12,26),(-32,38)), tilt=-10)
    # broken heart cushion, stitched back together
    b += f'<circle cx="400" cy="300" r="74" fill="#ffd9a0" opacity=".2"/>'
    b += '<g transform="translate(400 306) scale(3.4)">' + '<path d="M0 14 C-22 0 -18 -20 -7 -20 C-2 -20 0 -16 0 -13 C0 -16 2 -20 7 -20 C18 -20 22 0 0 14 Z" fill="#e5718a"/><path d="M0 -13 L-4 -4 L3 2 L-2 8 L0 14" stroke="#fff3d6" stroke-width=".9" fill="none" stroke-dasharray="1.2 1.4" stroke-linecap="round"/><path d="M-7 -20 C-18 -20 -22 0 0 14" fill="#fff" opacity=".12"/></g>'
    b += '<path d="M410 330 C440 340 470 300 500 310 S560 250 600 214" stroke="#f2c777" stroke-width="2.5" fill="none" stroke-dasharray="3 6" stroke-linecap="round"/><g transform="translate(600 214) rotate(-35)"><rect x="-2" y="-30" width="4" height="46" rx="2" fill="#fff3d6"/><ellipse cx="0" cy="-22" rx="1.8" ry="5" fill="#2a1424"/></g>'
    b += spark(150, 130, 1, .9) + spark(700, 60, .9, .9) + spark(400, 200, .8, .8)
    return wrap(b, W, H, u, '#241026', '#4e2142', '#7e3550')

@sc(f'{Cc}-2')
def _():
    u='c2'; b=''
    b += f'<circle cx="640" cy="120" r="170" fill="#ffd9a0" opacity=".18"/><circle cx="640" cy="120" r="54" fill="#ffe3b0"/>'
    b += star_field(8, 14, 0, 0, 500, 120)
    b += '<path d="M0 300 Q200 220 420 270 T800 200 V450 H0Z" fill="#7e3550"/><path d="M0 350 Q260 290 480 330 T800 280 V450 H0Z" fill="#4a2042"/><path d="M0 410 Q300 360 800 390 V450 H0Z" fill="#2a1430"/>'
    path = 'M-30 440 C160 420 260 360 360 330 S560 290 640 220 S760 150 800 130'
    b += f'<path d="{path}" stroke="#ffd9a0" stroke-width="54" fill="none" stroke-linecap="round" opacity=".92"/><path d="{path}" stroke="#f0a070" stroke-width="54" fill="none" stroke-linecap="round" opacity=".25" transform="translate(0 6)"/><path d="{path}" stroke="#fff3d6" stroke-width="3" fill="none" stroke-dasharray="14 14" opacity=".6"/>'
    pts=[(250,372),(350,328),(440,308),(530,282),(620,238),(710,178)]
    for i,(x,y) in enumerate(pts):
        sc_=1-i*.07
        b += f'<rect x="{x-2}" y="{y-56*sc_}" width="4" height="{56*sc_}" fill="#2a1424"/><circle cx="{x}" cy="{y-70*sc_}" r="{34*sc_}" fill="#ffd9a0" opacity=".3"/><circle cx="{x}" cy="{y-70*sc_}" r="{19*sc_}" fill="#fff0c8"/><text x="{x}" y="{y-63*sc_}" font-family="Georgia,serif" font-weight="700" font-size="{22*sc_}" fill="#8a4a30" text-anchor="middle">{i+1}</text>'
    b += person(110, 330, 1.1, skin=2, hair=0, style='short', top='rose', bottom='plum', la=((-14,26),(-10,52)), ra=((22,26),(46,38)), ll=((-14,38),(-24,78)), rl=((14,42),(26,74)), tilt=5)
    b += person(190, 330, 1.1, skin=0, hair=3, style='long', top='gold', bottom='deep', la=((-22,26),(-46,38)), ra=((14,26),(10,52)), ll=((-14,42),(-26,74)), rl=((14,38),(24,78)), tilt=-4)
    b += heart(700, 60, .9, '#e5718a') + spark(560, 110, 1, .9) + spark(300, 90, .8, .8)
    return wrap(b, W, H, u, '#33162e', '#8a3a50', '#f0a070')

@sc(f'{Cc}-3')
def _():
    u='c3'; b=''
    b += f'<rect y="270" width="{W}" height="12" fill="#000" opacity=".12"/>'
    for i in range(0,W,60):
        for j in range(160,330,40): b += f'<rect x="{i+2}" y="{j+2}" width="56" height="36" rx="4" fill="#fff" opacity=".04"/>'
    # shelf with jars
    b += '<rect x="60" y="118" width="300" height="10" rx="4" fill="#9a4a5c"/>'
    for i,(c,h) in enumerate([('#f2c777',46),('#e5718a',58),('#f8b8c0',40),('#e0956a',52),('#fff0d8',44)]):
        b += f'<rect x="{80+i*56}" y="{118-h}" width="40" height="{h}" rx="9" fill="{c}"/><rect x="{84+i*56}" y="{118-h-8}" width="32" height="9" rx="3" fill="#2a1424"/>'
    b += window_arch(470, 40, 130, 190, u, sky=('#2a1430','#8a3a50','#f0b080'), seed=3, moon=False)
    for x in (230, 640): b += f'<rect x="{x-1.5}" y="0" width="3" height="50" fill="#2a1424"/><path d="M{x-24} 82 L{x-12} 50 H{x+12} L{x+24} 82Z" fill="#f6c790"/><circle cx="{x}" cy="96" r="70" fill="#ffd9a0" opacity=".2"/>'
    b += person(230, 336, 1.25, skin=3, hair=5, style='curly', top='gold', bottom='plum', la=((-12,28),(0,40)), ra=((24,14),(50,18)), tilt=4)
    b += person(560, 336, 1.25, skin=0, hair=1, style='bun', top='rose', bottom='plum', la=((-18,18),(-36,4)), ra=((12,28),(-4,40)), tilt=-5)
    # kettle + cups
    b += '<g transform="translate(300 300)"><path d="M-18 -4 Q-18 -30 0 -30 Q18 -30 18 -4 V6 H-18Z" fill="#fff0d8"/><path d="M18 -12 l22 -10 l4 8 l-24 10" fill="#fff0d8"/><path d="M-16 -24 q-20 4 -18 22" stroke="#fff0d8" stroke-width="5" fill="none"/></g>'
    b += '<path d="M342 286 q8 20 4 36" stroke="#f6c790" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>'
    b += cup(350, 318, 1.2, steam=False) + cup(520, 258, 1.1, steam=False)
    # counter
    b += lin('c3t','#c0687a','#a04a62') + f'<rect x="0" y="318" width="{W}" height="18" fill="url(#c3t)"/><rect x="0" y="336" width="{W}" height="114" fill="#6a2a4a"/>'
    for i in range(1,5): b += f'<path d="M{i*160} 336 V450" stroke="#000" stroke-opacity=".18" stroke-width="3"/>'
    for x,y,s_ in [(410,200,1.3),(380,150,.9),(440,140,.9),(400,100,.7),(450,90,.6)]:
        b += f'<circle cx="{x}" cy="{y}" r="{22*s_}" fill="#ffd9a0" opacity=".25"/>' + heart(x, y, s_, '#f2c777' if s_>1 else '#e5718a')
    b += spark(120, 220, 1, .9) + spark(700, 120, .9, .9)
    return wrap(b, W, H, u, '#3a1a34', '#6a2c4c', '#a04a5c')

# ============ D: overthinking
@sc(f'{D}-1')
def _():
    u='d1'; b=''
    b += window_arch(560, 40, 150, 250, u, sky=('#120a20','#2f1a44','#7a3560'), seed=31)
    b += floor(370)
    # bed
    b += '<rect x="170" y="150" width="380" height="250" rx="40" fill="#5a2a56"/>'
    b += f'<rect x="196" y="230" width="150" height="56" rx="26" fill="#f8b8c0"/>'
    b += person(330, 316, 1.5, skin=1, hair=1, style='long', top='cream', bottom='mauve', la=((-6,30),(18,14)), ra=((8,30),(-4,12)), tilt=-8, shadow=False)
    b += f'<path d="M172 312 Q330 286 550 312 V420 H172Z" fill="#8a3a5c"/><path d="M172 312 Q330 286 550 312" stroke="#b05a7a" stroke-width="10" fill="none"/>'
    # side table + clock
    b += f'<rect x="590" y="330" width="130" height="12" rx="5" fill="#4a2442"/><rect x="604" y="342" width="9" height="60" fill="#4a2442"/><rect x="696" y="342" width="9" height="60" fill="#4a2442"/>'
    b += '<rect x="612" y="296" width="76" height="32" rx="10" fill="#fff3dc"/><text x="650" y="319" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="19" fill="#6a3a2a" text-anchor="middle">2:14</text>'
    # thought cloud with a spiral and questions
    cloud = lambda x,y,s_: f'<g transform="translate({x} {y}) scale({s_})"><circle cx="0" cy="0" r="52" fill="#fff3dc"/><circle cx="-56" cy="14" r="40" fill="#fff3dc"/><circle cx="58" cy="12" r="44" fill="#fff3dc"/><circle cx="-8" cy="36" r="46" fill="#fff3dc"/><circle cx="-90" cy="30" r="0" fill="#fff3dc"/></g>'
    b += cloud(190, 100, 1.2)
    sp=[]
    for i in range(121):
        t=i/120; a=t*3.6*2*math.pi; r=4+t*58
        sp.append(f'{190+r*math.cos(a):.1f} {108+r*math.sin(a)*.9:.1f}')
    b += f'<path d="M{" L".join(sp)}" stroke="#e5718a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b += '<circle cx="290" cy="196" r="12" fill="#fff3dc"/><circle cx="318" cy="228" r="8" fill="#fff3dc"/><circle cx="338" cy="252" r="5" fill="#fff3dc"/>'
    b += cloud(460, 70, .55) + '<text x="460" y="82" font-family="Georgia,serif" font-weight="700" font-size="40" fill="#b03a60" text-anchor="middle">?</text>'
    b += cloud(540, 140, .4) + '<text x="540" y="152" font-family="Georgia,serif" font-weight="700" font-size="30" fill="#b03a60" text-anchor="middle">?</text>'
    b += spark(40, 220, 1, .9) + spark(740, 330, .8, .8)
    return wrap(b, W, H, u, '#140a20', '#301640', '#6a2c58')

@sc(f'{D}-2')
def _():
    u='d2'; b=''
    b += floor(360) + rug(400, 412, 520, 46, '#4a2050')
    b += star_field(12, 20, 0, 0, W, 130)
    # calm cloud (facts)
    b += '<g transform="translate(160 130)"><circle r="62" fill="#fff3dc"/><circle cx="-70" cy="22" r="46" fill="#fff3dc"/><circle cx="74" cy="20" r="52" fill="#fff3dc"/><rect x="-100" y="22" width="190" height="44" rx="22" fill="#fff3dc"/></g>'
    b += bubble(104, 90, 110, 50, '#f2c777', 'l') + '<text x="159" y="124" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="24" fill="#6a3a2a" text-anchor="middle">ok.</text>'
    b += check(236, 70, 22)
    # storm cloud (story)
    b += '<g transform="translate(640 120)"><circle r="68" fill="#5a2a5a"/><circle cx="-76" cy="24" r="48" fill="#5a2a5a"/><circle cx="80" cy="22" r="54" fill="#5a2a5a"/><rect x="-110" y="24" width="206" height="46" rx="23" fill="#5a2a5a"/></g>'
    b += '<path d="M650 168 L624 214 L648 214 L630 258 L676 200 L652 200 L670 168Z" fill="#f2c777"/>'
    for (x,y,s_) in [(590,110,1),(660,96,1.2),(700,140,.9),(610,150,.8)]:
        b += f'<text x="{x}" y="{y}" font-family="Georgia,serif" font-weight="700" font-size="{40*s_}" fill="#f8b8c0" text-anchor="middle">?</text>'
    b += '<path d="M560 230 q-14 18 -6 36 M720 232 q12 20 4 38 M600 246 q-6 16 0 28" stroke="#9ad8ff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".45"/>'
    # person looking at phone
    b += person(400, 336, 1.3, skin=2, hair=0, style='short', top='deep', bottom='plum', la=((-12,28),(0,46)), ra=((20,10),(14,-8)), ll=((-9,40),(-10,80)), rl=((9,40),(10,80)), tilt=-6)
    b += phone(404, 214, 22, 38, u, 6, '#3a2038') + '</g>'
    b += '<path d="M370 214 C320 180 260 170 222 150" stroke="#fbdc9a" stroke-width="3" fill="none" stroke-dasharray="2 8" stroke-linecap="round"/><path d="M430 214 C500 190 540 190 570 180" stroke="#f8b8c0" stroke-width="3" fill="none" stroke-dasharray="2 8" stroke-linecap="round"/>'
    b += spark(60, 60, 1, .9) + spark(760, 60, .9, .8)
    return wrap(b, W, H, u, '#140a20', '#2c1642', '#5a2850')

@sc(f'{D}-3')
def _():
    u='d3'; b=''
    b += f'<circle cx="400" cy="262" r="260" fill="#ffd9a0" opacity=".14"/><circle cx="400" cy="262" r="130" fill="#ffd9a0" opacity=".18"/><circle cx="400" cy="262" r="64" fill="#ffe8b8"/>'
    rnd=random.Random(5); bx=0
    while bx<W:
        bw=rnd.uniform(40,90); bh=rnd.uniform(40,120)
        b += f'<rect x="{bx:.0f}" y="{300-bh:.0f}" width="{bw:.0f}" height="{bh+60:.0f}" fill="#4a2048"/>'
        for _ in range(3): b += f'<rect x="{bx+rnd.uniform(5,bw-12):.0f}" y="{300-bh+rnd.uniform(8,bh-10):.0f}" width="5" height="6" fill="#ffd9a0" opacity="{rnd.choice([0,.7,.9])}"/>'
        bx+=bw+4
    b += '<rect x="0" y="330" width="800" height="120" fill="#2a1430"/><rect x="0" y="322" width="800" height="10" fill="#3a1c3c"/>'
    for x in range(20,800,56): b += f'<rect x="{x}" y="332" width="6" height="90" fill="#1c0e20"/>'
    b += '<rect x="0" y="330" width="800" height="6" fill="#5a2a56"/>'
    b += rug(400, 418, 360, 40, '#e0956a')
    b += plant(70, 420, 1.5, seed=3) + plant(740, 420, 1.3, '#b8506a', seed=7)
    for r,op in [(170,.1),(130,.18),(92,.3)]: b += f'<circle cx="400" cy="320" r="{r}" fill="none" stroke="#fff3d6" stroke-width="3" opacity="{op}"/>'
    b += person(400, 396, 1.45, skin=3, hair=5, style='curly', top='cream', bottom='mauve', la=((-18,22),(-6,42)), ra=((18,22),(6,42)), ll=((-38,6),(-8,22)), rl=((38,6),(8,22)), tilt=0, shadow=False)
    b += cup(400, 366, 1.1, steam=True)
    for bx,by in [(180,120),(230,100),(620,90),(670,130)]: b += f'<path d="M{bx} {by} q8 -10 16 0 q8 -10 16 0" stroke="#4a2040" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    b += heart(400, 150, .8, '#fbdc9a', .9) + spark(120, 200, 1, .9) + spark(700, 220, .9, .9)
    return wrap(b, W, H, u, '#3a1a38', '#a04a5c', '#f0b080')

# ============ E: communication habits
@sc(f'{E}-1')
def _():
    u='e1'; b=''
    b += f'<circle cx="640" cy="130" r="90" fill="#ffd9a0" opacity=".2"/><circle cx="640" cy="130" r="40" fill="#ffe3b0"/>'
    # tree
    b += '<rect x="372" y="150" width="30" height="200" rx="10" fill="#4a2442"/>'
    for (x,y,r,c) in [(390,110,90,'#b8506a'),(320,150,64,'#d8707a'),(470,150,70,'#e0956a'),(390,60,60,'#e5718a'),(300,100,48,'#f0a070'),(480,80,46,'#c8586e')]:
        b += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
    b += '<path d="M0 360 Q300 330 800 356 V450 H0Z" fill="#4a2042"/><path d="M0 400 Q300 380 800 396 V450 H0Z" fill="#2a1430"/>'
    # bench
    b += '<rect x="200" y="322" width="400" height="16" rx="7" fill="#a04a5c"/><rect x="204" y="270" width="392" height="12" rx="5" fill="#8a3a50"/><rect x="226" y="338" width="10" height="46" fill="#2a1424"/><rect x="564" y="338" width="10" height="46" fill="#2a1424"/><rect x="226" y="282" width="8" height="44" fill="#8a3a50"/><rect x="566" y="282" width="8" height="44" fill="#8a3a50"/>'
    b += sitting(300, 322, 1.32, facing=1, skin=1, hair=0, style='short', top='gold', bottom='plum', la=((-8,28),(14,34)), ra=((14,28),(40,12)), tilt=6, ll=((20,2),(28,44)), rl=((30,4),(38,46)))
    b += sitting(500, 322, 1.32, facing=-1, skin=0, hair=2, style='bun', top='rose', bottom='ink', la=((-14,28),(-40,12)), ra=((8,28),(-14,34)), tilt=-6, ll=((-20,2),(-28,44)), rl=((-30,4),(-38,46)))
    b += bubble(224, 112, 120, 52, '#e5718a', 'r') + heart(284, 138, .9, '#fff3f0')
    b += bubble(470, 122, 130, 52, '#fff3dc', 'l') + dots3(515, 148, r=5)
    b += spark(120, 120, 1, .9) + spark(700, 230, .9, .9) + spark(430, 250, .7, .8)
    return wrap(b, W, H, u, '#2a1230', '#8a3a50', '#f0a070')

@sc(f'{E}-2')
def _():
    u='e2'; b=''
    b += f'<rect x="0" y="0" width="400" height="{H}" fill="#241030"/><rect x="400" y="0" width="400" height="{H}" fill="#6a2c4c"/>'
    b += f'<circle cx="600" cy="200" r="220" fill="#ffd9a0" opacity=".14"/>'
    b += star_field(9, 18, 0, 0, 400, 300)
    b += '<path d="M0 372 Q200 360 400 372 V450 H0Z" fill="#150a18"/><path d="M400 372 Q600 360 800 372 V450 H400Z" fill="#3a1a38"/>'
    b += '<path d="M400 20 V450" stroke="#fff3d6" stroke-width="3" stroke-dasharray="3 10" opacity=".4"/>'
    # left: sharp words
    b += spikes(280, 118, 84, 56, 12, '#b03a60') + txtlines(236, 104, [88, 58], '#ffd0dc', 20, 11)
    b += '<g transform="translate(190 60)"><circle r="20" fill="#5a1a38"/><path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#ffd0dc" stroke-width="4.5" stroke-linecap="round"/></g>'
    b += person(190, 328, 1.35, skin=2, hair=0, style='short', top='mauve', bottom='ink', la=((-20,-6),(-18,-34)), ra=((22,-4),(12,-30)), lean=-9, tilt=-8)
    # right: soft words
    b += '<g transform="translate(540 64)"><circle cx="40" cy="30" r="40" fill="#fff3dc"/><circle cx="96" cy="26" r="46" fill="#fff3dc"/><circle cx="150" cy="38" r="36" fill="#fff3dc"/><rect x="20" y="40" width="150" height="30" rx="15" fill="#fff3dc"/></g>'
    b += txtlines(598, 96, [96, 60], '#d9bf99', 20, 11) + heart(716, 94, .7, '#e5718a') + check(738, 40, 20)
    b += person(610, 328, 1.35, skin=4, hair=1, style='long', top='gold', bottom='deep', la=((-24,18),(-44,30)), ra=((24,18),(44,30)), tilt=5)
    b += spark(430, 60, 1, .9) + spark(760, 250, .9, .9)
    return wrap(b, W, H, u, '#241030', '#6a2c4c')

@sc(f'{E}-3')
def _():
    u='e3'; b=''
    b += window_arch(310, 36, 150, 220, u, sky=('#1a1030','#4e2250','#d98a6a'), seed=15)
    b += floor(356) + rug(400, 412, 560, 48, '#5a2850')
    b += lamp(700, 100, 260, u, glow_r=130) + plant(80, 400, 1.3, seed=9)
    b += sofa(80, 252, 280, '#8a3a5c', u, 100)
    b += f'<rect x="520" y="270" width="150" height="110" rx="34" fill="#7a2a48"/><rect x="510" y="330" width="170" height="50" rx="20" fill="#a03a5c"/><rect x="508" y="310" width="28" height="70" rx="12" fill="#8a3050"/><rect x="664" y="310" width="28" height="70" rx="12" fill="#8a3050"/>'
    b += sitting(200, 330, 1.3, facing=1, skin=0, hair=3, style='long', top='gold', bottom='plum', la=((12,20),(40,-2)), ra=((20,26),(52,12)), tilt=4)
    b += sitting(590, 340, 1.3, facing=-1, skin=3, hair=5, style='curly', top='cream', bottom='deep', la=((-6,28),(-18,40)), ra=((18,-6),(-2,-26)), tilt=-4, lean=-5)
    # sound waves from speaker to listener
    for i,r in enumerate([30,56,84]):
        b += f'<path d="M{300+i*30} {236-r*.7} A{r} {r} 0 0 1 {300+i*30} {236+r*.7}" stroke="#fbdc9a" stroke-width="5" fill="none" stroke-linecap="round" opacity="{.95-i*.25:.2f}"/>'
    b += f'<circle cx="598" cy="280" r="46" fill="#ffd9a0" opacity=".25"/>' + heart(598, 286, 1.2, '#e5718a')
    b += bubble(150, 110, 110, 46, '#fff3dc', 'l') + txtlines(170, 124, [70, 44], '#d9bf99', 14, 7)
    b += spark(60, 80, 1, .9) + spark(740, 220, .9, .9)
    return wrap(b, W, H, u, '#241026', '#4e2142', '#7e3550')

# ============ F: problems that keep coming back
@sc(f'{F}-1')
def _():
    u='f1'; b=''
    b += floor(364) + rug(400, 416, 480, 44, '#5a2850')
    b += loop(400, 236, 330, 170, '#e5718a', 10, 36, -80)
    for (x,y,r) in [(120,170,-6),(690,180,6),(400,74,0)]:
        b += bubble(x-40, y-18, 80, 36, '#fff3dc', 'l' if x<400 else 'r') + txtlines(x-26, y-6, [52, 30], '#d9bf99', 11, 6)
    b += '<rect x="190" y="314" width="420" height="14" rx="6" fill="#9a4a5c"/><rect x="396" y="328" width="10" height="60" fill="#4a2442"/>'
    b += sitting(280, 316, 1.25, facing=1, skin=2, hair=0, style='short', top='gold', bottom='plum', la=((8,-4),(20,-34)), ra=((22,6),(48,-12)), tilt=6, ll=((22,2),(28,42)), rl=((32,4),(38,44)))
    b += sitting(520, 316, 1.25, facing=-1, skin=0, hair=1, style='long', top='deep', bottom='ink', la=((-22,6),(-48,-12)), ra=((-8,-4),(-20,-34)), tilt=-6, ll=((-22,2),(-28,42)), rl=((-32,4),(-38,44)))
    b += '<g transform="translate(340 150)"><circle r="18" fill="#f2c777"/><text y="8" font-family="Georgia,serif" font-weight="700" font-size="24" fill="#6a3a2a" text-anchor="middle">!</text></g><g transform="translate(460 150)"><circle r="18" fill="#e5718a"/><text y="8" font-family="Georgia,serif" font-weight="700" font-size="24" fill="#fff3f0" text-anchor="middle">!</text></g>'
    b += cup(400, 312, 1.1, steam=False)
    b += spark(70, 60, 1, .9) + spark(740, 330, .9, .8)
    return wrap(b, W, H, u, '#140a20', '#2a1440', '#5a2850')

@sc(f'{F}-2')
def _():
    u='f2'; b=''
    b += star_field(7, 16, 0, 0, W, 60)
    ws, ys, hh = 126, 70, 300
    xs=[34+i*148 for i in range(5)]
    cols=[('#3a1c3c','#a04a62'),('#241030','#5a2850'),('#2a1430','#7e3a52'),('#2a1236','#8a4060'),('#1c1030','#6a2c58')]
    # 1 chores: laundry basket + dishes + broom
    c = f'<rect x="{xs[0]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#1c0e20"/>'
    c += f'<path d="M{xs[0]+18} {ys+hh-96} H{xs[0]+78} L{xs[0]+70} {ys+hh-30} H{xs[0]+26}Z" fill="#e0956a"/><rect x="{xs[0]+14}" y="{ys+hh-104}" width="68" height="10" rx="4" fill="#f6b793"/>'
    c += f'<path d="M{xs[0]+30} {ys+hh-104} q8 -30 22 -22 q14 -12 22 8 q10 6 -2 16z" fill="#f8b8c0"/><path d="M{xs[0]+40} {ys+hh-110} q6 -20 20 -14" stroke="#fff0d8" stroke-width="10" fill="none" stroke-linecap="round"/>'
    for i in range(3): c += f'<ellipse cx="{xs[0]+100}" cy="{ys+hh-40-i*8}" rx="22" ry="5" fill="#fff0d8"/>'
    c += f'<rect x="{xs[0]+90}" y="{ys+hh-150}" width="5" height="100" fill="#8a4a38" transform="rotate(10 {xs[0]+92} {ys+hh-50})"/>'
    b += tile(xs[0], ys, ws, hh, 'f2a', cols[0], c)
    # 2 time: clock + phone
    c = f'<rect x="{xs[1]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#1c0e20"/>'
    c += f'<circle cx="{xs[1]+ws/2}" cy="{ys+120}" r="46" fill="#fff0d8"/><circle cx="{xs[1]+ws/2}" cy="{ys+120}" r="38" fill="none" stroke="#b03a60" stroke-width="5"/><path d="M{xs[1]+ws/2} {ys+120-26} V{ys+120} L{xs[1]+ws/2+18} {ys+120+10}" stroke="#b03a60" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    c += phone(xs[1]+ws/2-22, ys+hh-130, 44, 78, 'f2p', -6, '#3a2038') + '</g>' + bubble(xs[1]+ws/2-22, ys+hh-120, 38, 22, '#fff3dc', 'l') + dots3(xs[1]+ws/2-14, ys+hh-109, r=2.6, gap=9)
    b += tile(xs[1], ys, ws, hh, 'f2b', cols[1], c)
    # 3 money: coins + wallet
    c = f'<rect x="{xs[2]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#1c0e20"/>'
    for i,(dx,dy) in enumerate([(0,0),(32,6),(-30,10),(8,-30)]):
        c += f'<circle cx="{xs[2]+ws/2+dx}" cy="{ys+150+dy}" r="30" fill="#f2c777"/><circle cx="{xs[2]+ws/2+dx}" cy="{ys+150+dy}" r="22" fill="none" stroke="#c98a30" stroke-width="3"/>'
    c += f'<text x="{xs[2]+ws/2+8}" y="{ys+150-30+9}" font-family="Georgia,serif" font-weight="700" font-size="26" fill="#9a5a1a" text-anchor="middle">$</text>'
    c += f'<rect x="{xs[2]+20}" y="{ys+hh-112}" width="{ws-40}" height="62" rx="14" fill="#b03a60"/><rect x="{xs[2]+ws-52}" y="{ys+hh-92}" width="34" height="22" rx="8" fill="#e5718a"/><circle cx="{xs[2]+ws-38}" cy="{ys+hh-81}" r="4" fill="#fff3dc"/>'
    b += tile(xs[2], ys, ws, hh, 'f2c', cols[2], c)
    # 4 closeness: two people far apart
    c = f'<rect x="{xs[3]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#1c0e20"/>'
    c += person(xs[3]+30, ys+hh-84, .74, skin=2, hair=0, style='short', top='gold', bottom='plum', la=((-12,24),(-6,48)), ra=((12,24),(8,46)), ll=((-9,36),(-10,70)), rl=((9,36),(10,70)), tilt=-6)
    c += person(xs[3]+ws-30, ys+hh-84, .74, skin=0, hair=1, style='long', top='rose', bottom='ink', la=((-12,24),(-8,46)), ra=((12,24),(6,48)), ll=((-9,36),(-10,70)), rl=((9,36),(10,70)), tilt=6)
    c += f'<path d="M{xs[3]+52} {ys+120} H{xs[3]+ws-52}" stroke="#fbdc9a" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>' + heart(xs[3]+ws/2, ys+96, .6, '#e5718a', .8)
    b += tile(xs[3], ys, ws, hh, 'f2d', cols[3], c)
    # 5 same fight: loop
    c = f'<rect x="{xs[4]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#1c0e20"/>'
    c += loop(xs[4]+ws/2, ys+150, 40, 40, '#e5718a', 8, 46, -60)
    c += bubble(xs[4]+10, ys+hh-100, 48, 28, '#fff3dc', 'l') + bubble(xs[4]+ws-58, ys+hh-74, 48, 28, '#f2c777', 'r') + txtlines(xs[4]+18, ys+hh-92, [30], '#d9bf99', 10, 6) + txtlines(xs[4]+ws-50, ys+hh-66, [30], '#a07a3a', 10, 6)
    b += tile(xs[4], ys, ws, hh, 'f2e', cols[4], c)
    b += spark(20, 50, 1, .9) + spark(780, 60, .9, .8) + spark(400, 40, .8, .8)
    return wrap(b, W, H, u, '#140a20', '#2a1440', '#5a2850')

@sc(f'{F}-3')
def _():
    u='f3'; b=''
    b += f'<circle cx="610" cy="130" r="190" fill="#ffd9a0" opacity=".16"/><circle cx="610" cy="130" r="56" fill="#ffe3b0"/>'
    b += '<path d="M0 290 Q200 230 420 270 T800 220 V450 H0Z" fill="#8a3a50"/><path d="M0 340 Q260 290 480 322 T800 290 V450 H0Z" fill="#4a2042"/><path d="M0 400 Q300 360 800 390 V450 H0Z" fill="#26122a"/>'
    # circular track on the ground (perspective ellipse) with an opening
    b += '<path d="M290 396 A200 56 0 1 1 460 380" stroke="#f8b8c0" stroke-width="8" fill="none" stroke-dasharray="3 16" stroke-linecap="round" opacity=".8"/>'
    b += '<path d="M440 360 C480 330 520 300 560 270 S640 200 700 170" stroke="#ffd9a0" stroke-width="40" fill="none" stroke-linecap="round" opacity=".9"/><path d="M440 360 C480 330 520 300 560 270 S640 200 700 170" stroke="#fff3d6" stroke-width="3" fill="none" stroke-dasharray="12 12" opacity=".6"/>'
    b += loop(230, 330, 130, 44, '#e5718a', 7, 70, 10)
    b += person(150, 340, 1.1, skin=3, hair=5, style='curly', top='gold', bottom='plum', la=((-14,26),(-10,50)), ra=((16,26),(14,50)), ll=((-9,40),(-12,80)), rl=((9,40),(10,80)), tilt=-4)
    b += person(480, 336, 1.2, skin=1, hair=0, style='bun', top='rose', bottom='plum', la=((-22,22),(-44,34)), ra=((20,26),(38,12)), ll=((-14,40),(-22,80)), rl=((16,38),(32,72)), tilt=4)
    b += person(560, 322, 1.1, skin=0, hair=3, style='long', top='cream', bottom='deep', la=((-20,22),(-40,14)), ra=((20,26),(16,50)), ll=((-9,40),(-12,80)), rl=((9,40),(10,80)), tilt=-5)
    b += heart(650, 70, .9, '#e5718a') + spark(300, 110, 1, .9) + spark(740, 90, .9, .9) + spark(90, 90, .8, .8)
    return wrap(b, W, H, u, '#33162e', '#8a3a50', '#f0a070')

if __name__ == '__main__':
    import os; os.makedirs(OUT, exist_ok=True)
    for n,f in S.items(): open(f'{OUT}/{n}.svg','w').write(f())
    print(len(S))
