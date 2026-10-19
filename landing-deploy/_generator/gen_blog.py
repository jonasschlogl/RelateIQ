"""18 wide (16:9) blog illustrations: 3 per article. Same two faceless pawn characters as the landing page."""
import math, random, sys
sys.path.insert(0, '/root/lp')
from gen_scenes import defs, pawn, heart, spark, GOLD, ROSE
W, H = 800, 450
OUT = '/root/lp/blogimg'

BG = {
 'dusk':  ('#241123', '#5e2447', '#b9546c'),
 'night': ('#120a1d', '#2f173a', '#7e3558'),
 'dawn':  ('#2a1422', '#8a3a48', '#f0b47a'),
 'warm':  ('#33172a', '#8f3f55', '#ee9d78'),
 'plum':  ('#1c0f1f', '#43203a', '#9a4660'),
}
def svg(body, bg='dusk', uid='x', seed=1, nstars=22, ground=None, gy=360):
    c = BG[bg]
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
    s += defs(uid)
    s += f'<linearGradient id="{uid}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c[0]}"/><stop offset=".55" stop-color="{c[1]}"/><stop offset="1" stop-color="{c[2]}"/></linearGradient>'
    s += f'<rect width="{W}" height="{H}" fill="url(#{uid}bg)"/>'
    rnd = random.Random(seed)
    for _ in range(nstars):
        s += f'<circle cx="{rnd.uniform(8,W-8):.0f}" cy="{rnd.uniform(8,gy-60):.0f}" r="{rnd.choice([1,1.2,1.6,2]):.1f}" fill="#fff3d6" opacity="{rnd.uniform(.25,.75):.2f}"/>'
    if ground:
        s += f'<path d="M0 {gy} Q{W/2} {gy-26} {W} {gy} V{H} H0Z" fill="{ground}" opacity=".8"/>'
    s += body + '</svg>'
    return s

def cream(x, y, w, h, r=None, tail=None, op=1):
    """cream message bubble; tail = 'l' or 'r' small triangle at bottom."""
    r = r if r is not None else min(h/2, 24)
    o = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="#fff3dc" opacity="{op}"/>'
    if tail == 'l': o += f'<path d="M{x+r*.8} {y+h-2} L{x+r*.3} {y+h+16} L{x+r*2} {y+h-2}Z" fill="#fff3dc" opacity="{op}"/>'
    if tail == 'r': o += f'<path d="M{x+w-r*.8} {y+h-2} L{x+w-r*.3} {y+h+16} L{x+w-r*2} {y+h-2}Z" fill="#fff3dc" opacity="{op}"/>'
    return o
def rose_b(x, y, w, h, r=None, tail=None):
    r = r if r is not None else min(h/2, 24)
    o = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="#e5718a"/>'
    if tail == 'l': o += f'<path d="M{x+r*.8} {y+h-2} L{x+r*.3} {y+h+16} L{x+r*2} {y+h-2}Z" fill="#e5718a"/>'
    if tail == 'r': o += f'<path d="M{x+w-r*.8} {y+h-2} L{x+w-r*.3} {y+h+16} L{x+w-r*2} {y+h-2}Z" fill="#e5718a"/>'
    return o
def lines(x, y, ws, col='#d9bf99', gap=18, h=9):
    return ''.join(f'<rect x="{x}" y="{y+i*gap}" width="{w}" height="{h}" rx="{h/2}" fill="{col}"/>' for i, w in enumerate(ws))
def dots(x, y, col='#c98a50'):
    return ''.join(f'<circle cx="{x+i*17}" cy="{y}" r="4.6" fill="{col}"/>' for i in range(3))
def qmark(x, y, s=1, col='#fff3dc', op=1):
    return f'<text x="{x}" y="{y}" font-family="Georgia,serif" font-weight="700" font-size="{44*s:.0f}" fill="{col}" opacity="{op}" text-anchor="middle">?</text>'
def check(x, y, r=26):
    return f'<g transform="translate({x} {y})"><circle r="{r}" fill="#f2c777"/><path d="M{-r*.4:.1f} {r*.03:.1f} L{-r*.1:.1f} {r*.34:.1f} L{r*.44:.1f} {-r*.3:.1f}" stroke="#3b1f10" stroke-width="{r*.22:.1f}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
def sun(x, y, r, uid):
    return f'<circle cx="{x}" cy="{y}" r="{r*2.2}" fill="url(#{uid}glow)" opacity=".8"/><circle cx="{x}" cy="{y}" r="{r}" fill="url(#{uid}g)"/>'
def moon(x, y, r, uid):
    h = r*.957
    return f'<circle cx="{x}" cy="{y}" r="{r*1.8}" fill="url(#{uid}glow)" opacity=".6"/><path d="M{x+r*.25:.1f} {y-h:.1f} A{r} {r} 0 1 0 {x+r*.25:.1f} {y+h:.1f} A{h:.1f} {h:.1f} 0 1 1 {x+r*.25:.1f} {y-h:.1f}Z" fill="url(#{uid}g)"/>'
def phone(x, y, w, h, rot=0, glow=True):
    o = f'<g transform="rotate({rot} {x+w/2} {y+h/2})">'
    o += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w*.14:.0f}" fill="#1b0f18" stroke="#6a4a5a" stroke-width="2.5"/>'
    o += f'<rect x="{x+6}" y="{y+8}" width="{w-12}" height="{h-16}" rx="{w*.1:.0f}" fill="#2a1824"/>'
    return o
def loop_arrow(cx, cy, r, col='#e5718a', sw=10, gap=40, start=-60):
    a0 = math.radians(start + gap/2); a1 = math.radians(start + 360 - gap/2)
    x0, y0 = cx + r*math.cos(a0), cy + r*math.sin(a0)
    x1, y1 = cx + r*math.cos(a1), cy + r*math.sin(a1)
    o = f'<path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 1 1 {x1:.1f} {y1:.1f}" stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>'
    ang = a1 + math.pi/2
    tip = (x1 + 22*math.cos(ang), y1 + 22*math.sin(ang))
    l = (x1 + 17*math.cos(ang+2.2), y1 + 17*math.sin(ang+2.2)); rr = (x1 + 17*math.cos(ang-2.2), y1 + 17*math.sin(ang-2.2))
    o += f'<path d="M{tip[0]:.1f} {tip[1]:.1f} L{l[0]:.1f} {l[1]:.1f} L{rr[0]:.1f} {rr[1]:.1f}Z" fill="{col}" stroke="{col}" stroke-width="3" stroke-linejoin="round"/>'
    return o
def ring(cx, cy, r, col='#fff3d6', op=.4, sw=3):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-width="{sw}" opacity="{op}"/>'
def spiral(cx, cy, turns=3.2, r0=6, r1=70, col='#e5718a', sw=6):
    pts = []
    n = int(turns*40)
    for i in range(n+1):
        t = i/n; a = t*turns*2*math.pi; r = r0 + (r1-r0)*t
        pts.append(f'{cx + r*math.cos(a):.1f} {cy + r*math.sin(a):.1f}')
    return f'<path d="M{" L".join(pts)}" stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
def big_heart(x, y, s, fill, op=1, rot=0):
    return heart(x, y, s, fill, op, rot)

SCENES = {}
def scene(name):
    def d(f): SCENES[name] = f; return f
    return d

A = '2026-10-08-how-attachment-styles-work-in-relationships'
B = '2026-10-08-how-to-apologize-to-your-partner'
C = '2026-10-04-how-to-fix-a-relationship'
D = '2026-10-08-how-to-stop-overthinking-in-a-relationship'
E = '2026-10-05-relationship-advice-communication-habits'
F = '2026-10-03-relationship-problems-that-keep-coming-back'

# ---------------- A: attachment styles
@scene(f'{A}-1')
def _():
    u='a1'; b=''
    b += moon(690, 80, 34, u)
    gy = 372
    xs = [130, 300, 500, 670]
    # secure: gold upright with heart bubble
    b += pawn(u, xs[0], gy, 74, 150, 'g')
    b += '<g>' + rose_b(xs[0]-38, 118, 76, 44, tail='l').replace('#e5718a', 'url(#a1r)') + heart(xs[0], 140, .75, '#fff3f0') + '</g>'
    # anxious: rose leaning, dots bubble
    b += pawn(u, xs[1], gy, 70, 138, 'r', rot=-9)
    b += cream(xs[1]-44, 126, 88, 44, tail='l') + dots(xs[1]-17, 148)
    # avoidant: gold far with wall
    b += pawn(u, xs[2], gy, 70, 150, 'g', rot=6)
    b += f'<rect x="{xs[2]-98}" y="270" width="16" height="102" rx="6" fill="#4a2640"/><rect x="{xs[2]-104}" y="262" width="28" height="12" rx="6" fill="#5e3252"/>'
    b += cream(xs[2]-34, 130, 88, 44, tail='r') + lines(xs[2]-18, 144, [56], '#d9bf99') + lines(xs[2]-18, 144, [56])
    # fearful: rose with two arrows
    b += pawn(u, xs[3], gy, 70, 144, 'r', rot=0)
    b += f'<path d="M{xs[3]-52} 150 H{xs[3]+52}" stroke="#fbdc9a" stroke-width="6" stroke-linecap="round"/><path d="M{xs[3]-52} 150 l14 -12 M{xs[3]-52} 150 l14 12 M{xs[3]+52} 150 l-14 -12 M{xs[3]+52} 150 l-14 12" stroke="#fbdc9a" stroke-width="6" stroke-linecap="round"/>'
    b += spark(60, 70, 1, .9) + spark(430, 70, .9, .8) + spark(740, 250, .7, .7)
    return svg(b, 'night', u, 3, 26, '#1b0d24')

@scene(f'{A}-2')
def _():
    u='a2'; b=''
    b += moon(120, 90, 30, u)
    # big phone with unread dots
    b += phone(480, 40, 190, 330, 6)
    b += '</g>'
    b += cream(498, 92, 120, 40, tail='l', op=.95) + dots(526, 112)
    b += rose_b(530, 150, 120, 40, tail='r') + lines(546, 166, [70], '#ffe9ee')
    b += cream(498, 212, 70, 40, tail='l', op=.95) + dots(512, 232)
    # clock pill
    b += '<rect x="250" y="70" width="150" height="56" rx="28" fill="#fff3dc"/><text x="325" y="108" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="30" fill="#6a3a2a" text-anchor="middle">11:47</text>'
    # pawn in bed-ish: pawn sitting low at the left of phone
    b += '<rect x="90" y="318" width="330" height="64" rx="22" fill="#4a2442"/><rect x="90" y="318" width="330" height="22" rx="11" fill="#6a3558"/>'
    b += pawn(u, 220, 330, 78, 110, 'r', rot=-5)
    b += heart(300, 235, .7, '#e5718a', .9) + heart(330, 262, .45, '#e5718a', .7)
    b += spark(430, 340, .8, .8)
    return svg(b, 'night', u, 11, 30, '#1b0d24', 400)

@scene(f'{A}-3')
def _():
    u='a3'; b=''
    b += sun(640, 110, 46, u)
    # stairs
    steps = [(70,350),(190,310),(310,270),(430,230),(550,190)]
    for i,(x,y) in enumerate(steps):
        b += f'<rect x="{x}" y="{y}" width="130" height="{420-y}" rx="14" fill="#{["5a2a4a","6a3254","7a3a5a","8c4264","9e4a6c"][i]}"/>'
        b += f'<rect x="{x}" y="{y}" width="130" height="12" rx="6" fill="#fbdc9a" opacity=".5"/>'
    b += pawn(u, 370, 270, 56, 92, 'g', rot=3)
    b += pawn(u, 130, 350, 50, 82, 'r', rot=-3)
    b += heart(615, 168, 1.1, '#e5718a') + spark(690, 200, .8, .9) + spark(520, 120, .7, .8)
    return svg(b, 'dawn', u, 5, 14, '#2a1422', 410)

# ---------------- B: apologize
@scene(f'{B}-1')
def _():
    u='b1'; b=''
    b += f'<circle cx="400" cy="220" r="200" fill="url(#{u}rg)" opacity=".35"/>'
    b += pawn(u, 270, 372, 90, 176, 'r', rot=-4)
    b += pawn(u, 540, 372, 90, 186, 'g', rot=4)
    # heart held out between
    b += f'<circle cx="405" cy="250" r="64" fill="url(#{u}glow)"/>'
    b += heart(405, 252, 2.4, '#fbdc9a') + heart(405, 252, 1.7, '#e5718a')
    b += f'<path d="M318 300 Q360 320 380 290" stroke="#e5718a" stroke-width="12" stroke-linecap="round" fill="none"/>'
    b += spark(150, 110, 1.1, .9) + spark(660, 90, 1, .9) + spark(400, 90, .8, .8) + spark(700, 250, .7, .7)
    return svg(b, 'dusk', u, 7, 16, '#1d0d1f')

@scene(f'{B}-2')
def _():
    u='b2'; b=''
    items = [(110, 'cream', [150, 110]), (200, 'cream', [170, 90]), (290, 'cream', [130, 150])]
    for i, (y, _, ws) in enumerate(items):
        x = 210 + i*30
        b += f'<g transform="translate(0 {i*8})">' + cream(x, y-38, 330, 66, r=33)
        b += f'<circle cx="{x+36}" cy="{y-5}" r="21" fill="url(#{u}g)"/><text x="{x+36}" y="{y+3}" font-family="Georgia,serif" font-weight="700" font-size="24" fill="#4a2a1a" text-anchor="middle">{i+1}</text>'
        b += lines(x+74, y-18, [ws[0]+60], '#d9bf99', 18, 9) + lines(x+74, y+2, [ws[1]+30], '#e5718a' if i==0 else '#d9bf99', 18, 9)
        b += '</g>'
    b += check(620, 112, 24) + check(650, 210, 24)
    b += pawn(u, 112, 400, 66, 120, 'r', rot=-4)
    b += heart(112, 252, .9, '#fbdc9a', .9) + spark(740, 330, .9, .9) + spark(180, 90, .8, .8)
    return svg(b, 'dawn', u, 13, 12, '#2a1422', 410)

@scene(f'{B}-3')
def _():
    u='b3'; b=''
    b += sun(400, 250, 70, u)
    b += f'<path d="M0 330 Q200 270 400 310 T800 300 V450 H0Z" fill="#2e1428"/><path d="M0 370 Q220 330 420 360 T800 350 V450 H0Z" fill="#1b0d1f"/>'
    b += pawn(u, 345, 345, 74, 140, 'r', rot=6)
    b += pawn(u, 438, 345, 74, 150, 'g', rot=-6)
    b += heart(392, 190, 1.2, '#fff3f0', .95) + spark(160, 140, 1, .9) + spark(650, 110, 1, .9) + spark(560, 260, .7, .8)
    return svg(b, 'warm', u, 17, 10, None)

# ---------------- C: fix a relationship
@scene(f'{C}-1')
def _():
    u='c1'; b=''
    # broken heart halves with a gold seam
    L = f'<path d="M400 330 C250 240 250 110 340 100 C380 96 400 130 400 150 L372 195 L420 240 L385 290 Z" fill="url(#{u}r)"/>'
    R = f'<path d="M400 330 C550 240 550 110 460 100 C420 96 405 130 405 150 L378 195 L426 240 L391 290 Z" fill="url(#{u}r)" transform="translate(12 0)"/>'
    b += f'<circle cx="400" cy="210" r="190" fill="url(#{u}rg)" opacity=".35"/>' + L + R
    b += '<path d="M400 150 L372 195 L420 240 L385 290" stroke="#fbdc9a" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 14" transform="translate(6 0)"/>'
    b += pawn(u, 190, 380, 72, 130, 'g', rot=8) + pawn(u, 610, 380, 72, 130, 'g', rot=-8)
    b += f'<path d="M232 270 Q300 250 345 232" stroke="#fbdc9a" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M568 270 Q500 250 455 232" stroke="#fbdc9a" stroke-width="8" stroke-linecap="round" fill="none"/>'
    b += spark(110, 120, 1, .9) + spark(700, 110, 1, .9) + spark(400, 60, .8, .8)
    return svg(b, 'plum', u, 19, 18, '#150a18')

@scene(f'{C}-2')
def _():
    u='c2'; b=''
    cols = ['#5a2a4a','#6c3356','#7e3c60','#90456a','#a24e74','#b4587e']
    for i in range(6):
        x = 60 + i*112; y = 340 - i*44
        b += f'<rect x="{x}" y="{y}" width="104" height="{430-y}" rx="14" fill="{cols[i]}"/><rect x="{x}" y="{y}" width="104" height="10" rx="5" fill="#fbdc9a" opacity=".55"/>'
        b += f'<text x="{x+52}" y="{y+44}" font-family="Georgia,serif" font-weight="700" font-size="30" fill="#fbdc9a" opacity=".85" text-anchor="middle">{i+1}</text>'
    b += pawn(u, 112, 340, 46, 74, 'g', rot=3)
    b += f'<path d="M620 120 V70" stroke="#fff3d6" stroke-width="4"/><path d="M620 70 h50 l-12 14 l12 14 h-50Z" fill="url(#{u}r)"/>' if False else ''
    b += heart(648, 80, 1.3, '#e5718a') + f'<circle cx="648" cy="86" r="50" fill="url(#{u}glow)" opacity=".5"/>' + heart(648, 80, 1.3, '#fbdc9a')
    b += spark(450, 80, .9, .8) + spark(300, 140, .7, .8) + spark(740, 200, .8, .8)
    return svg(b, 'dawn', u, 23, 14)

@scene(f'{C}-3')
def _():
    u='c3'; b=''
    b += pawn(u, 280, 372, 80, 130, 'g', rot=-3) + pawn(u, 520, 372, 80, 122, 'r', rot=3)
    b += '<rect x="340" y="330" width="120" height="14" rx="7" fill="#4a2442"/><rect x="370" y="344" width="10" height="28" fill="#4a2442"/><rect x="420" y="344" width="10" height="28" fill="#4a2442"/>'
    b += '<rect x="378" y="304" width="44" height="26" rx="10" fill="#fff3dc"/><path d="M422 312 q16 2 12 14 q-2 4 -12 4" stroke="#fff3dc" stroke-width="5" fill="none"/>'
    pos = [(330,230,1.0),(400,170,1.25),(470,230,1.0),(365,110,.8),(435,100,.8)]
    for (x,y,s) in pos:
        b += f'<circle cx="{x}" cy="{y}" r="{26*s}" fill="url(#{u}glow)" opacity=".5"/>' + heart(x, y, s, '#fbdc9a')
    b += heart(640, 190, .6, '#e5718a', .85) + spark(120, 120, 1, .9) + spark(700, 90, .9, .9)
    return svg(b, 'plum', u, 29, 20, '#150a18')

# ---------------- D: overthinking
@scene(f'{D}-1')
def _():
    u='d1'; b=''
    b += moon(130, 90, 30, u)
    b += pawn(u, 400, 400, 96, 160, 'r')
    b += spiral(400, 130, 3.4, 6, 78, '#e5718a', 7) + spiral(400, 130, 3.4, 6, 78, '#fbdc9a', 2)
    b += cream(560, 70, 150, 46, tail='l', op=.9) + qmark(635, 110, .95, '#b03a60')
    b += cream(110, 150, 120, 40, tail='r', op=.9) + qmark(170, 184, .8, '#b03a60')
    b += cream(610, 210, 110, 38, tail='l', op=.85) + qmark(665, 242, .7, '#b03a60')
    return svg(b, 'night', u, 31, 30, '#1b0d24', 400)

@scene(f'{D}-2')
def _():
    u='d2'; b=''
    b += phone(300, 60, 200, 330, 0) + '</g>'
    b += cream(318, 120, 140, 50, tail='l', op=.97) + '<text x="388" y="154" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="24" fill="#6a3a2a" text-anchor="middle">ok.</text>'
    b += cream(318, 210, 90, 40, tail='l', op=.97) + dots(332, 230)
    # facts vs story columns
    b += cream(70, 100, 170, 70, r=22, op=.95) + lines(90, 122, [110, 80], '#d9bf99') + '<text x="155" y="94" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="14" letter-spacing="2" fill="#fbdc9a" text-anchor="middle">FACTS</text>'
    b += rose_b(560, 100, 180, 70, r=22) + lines(580, 122, [120, 90], '#ffe9ee') + '<text x="650" y="94" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="14" letter-spacing="2" fill="#f6b5c4" text-anchor="middle">STORY</text>'
    for (x,y,s) in [(590,230,1),(660,270,.8),(560,300,.7),(700,210,.7)]:
        b += qmark(x, y, s, '#f6b5c4', .9)
    b += pawn(u, 120, 400, 66, 110, 'g', rot=-5) + pawn(u, 690, 400, 60, 100, 'r', rot=5)
    b += spark(250, 300, .8, .8)
    return svg(b, 'plum', u, 37, 20, '#150a18', 400)

@scene(f'{D}-3')
def _():
    u='d3'; b=''
    b += moon(610, 110, 40, u)
    b += f'<path d="M0 340 Q200 300 400 330 T800 320 V450 H0Z" fill="#2e1428"/>'
    b += ring(330, 280, 150, '#fff3d6', .12, 3) + ring(330, 280, 110, '#fff3d6', .2, 3) + ring(330, 280, 72, '#fbdc9a', .35, 3)
    b += pawn(u, 330, 350, 84, 120, 'r', rot=0)
    b += heart(330, 214, .6, '#fbdc9a', .9)
    b += '<g stroke="#fbdc9a" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"><path d="M470 250 q30 -20 60 0"/><path d="M490 285 q26 -16 52 0"/></g>'
    b += spark(150, 110, 1, .9) + spark(720, 250, .8, .8) + spark(520, 70, .7, .8)
    return svg(b, 'night', u, 41, 34)

# ---------------- E: communication habits
@scene(f'{E}-1')
def _():
    u='e1'; b=''
    b += pawn(u, 230, 372, 94, 176, 'g', rot=4) + pawn(u, 570, 372, 94, 160, 'r', rot=-4)
    b += rose_b(150, 84, 160, 62, tail='r').replace('#e5718a', 'url(#e1r)') + heart(230, 116, 1.0, '#fff3f0')
    b += cream(470, 110, 150, 54, tail='l') + dots(515, 137)
    b += f'<path d="M345 250 H455" stroke="#fbdc9a" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>'
    b += spark(400, 90, 1, .9) + spark(710, 90, .9, .9) + spark(90, 280, .8, .8)
    return svg(b, 'dusk', u, 43, 18, '#1d0d1f')

@scene(f'{E}-2')
def _():
    u='e2'; b=''
    # spiky rose bubble (bad) vs soft gold bubble (good)
    spikes = ''
    cx, cy = 230, 215
    pts = []
    for i in range(24):
        a = i/24*2*math.pi; r = 98 if i%2==0 else 66
        pts.append(f'{cx+r*math.cos(a):.1f} {cy+r*math.sin(a):.1f}')
    b += f'<path d="M{" L".join(pts)}Z" fill="#b03a60"/>' 
    b += lines(180, 190, [100, 70], '#ffd0dc', 22, 11)
    b += f'<g transform="translate(230 340)"><circle r="22" fill="#5a1a38"/><path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#ffd0dc" stroke-width="5" stroke-linecap="round"/></g>'
    b += cream(450, 150, 250, 130, r=65, tail='l') + lines(498, 195, [150, 110], '#d9bf99', 22, 11) + heart(668, 160, .6, '#e5718a')
    b += check(660, 340, 24)
    b += '<path d="M370 215 H430" stroke="#fbdc9a" stroke-width="6" stroke-linecap="round"/><path d="M416 200 L432 215 L416 230" stroke="#fbdc9a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b += spark(90, 80, 1, .9) + spark(740, 80, .9, .9) + spark(400, 380, .8, .8)
    return svg(b, 'plum', u, 47, 16)

@scene(f'{E}-3')
def _():
    u='e3'; b=''
    b += pawn(u, 500, 380, 100, 190, 'g', rot=-2)
    for i, r in enumerate([52, 88, 124]):
        b += f'<path d="M{330-r*.2:.0f} {230-r*.7:.0f} A{r} {r} 0 0 0 {330-r*.2:.0f} {230+r*.7:.0f}" stroke="#fbdc9a" stroke-width="6" fill="none" stroke-linecap="round" opacity="{.95-i*.22:.2f}" transform="translate({-i*6} 0)"/>'
    b += pawn(u, 190, 380, 68, 112, 'r', rot=6)
    b += heart(500, 270, 1.6, '#b03a60', .95) + f'<circle cx="500" cy="262" r="56" fill="url(#{u}rg)" opacity=".7"/>' + heart(500, 270, 1.6, '#b03a60', .95)
    b += cream(300, 90, 120, 46, tail='l') + lines(322, 108, [76], '#d9bf99')
    b += spark(120, 120, 1, .9) + spark(700, 110, 1, .9) + spark(640, 300, .7, .8)
    return svg(b, 'dusk', u, 53, 18, '#1d0d1f', 400)

# ---------------- F: problems that keep coming back
@scene(f'{F}-1')
def _():
    u='f1'; b=''
    b += loop_arrow(400, 215, 170, '#e5718a', 14, 36, -70)
    b += pawn(u, 330, 350, 70, 130, 'g', rot=4) + pawn(u, 470, 350, 70, 120, 'r', rot=-4)
    b += cream(310, 80, 180, 54, tail='l') + lines(335, 100, [60, 36], '#d9bf99', 16, 9)
    b += spark(110, 110, 1, .9) + spark(700, 100, 1, .9) + spark(700, 330, .8, .8)
    return svg(b, 'night', u, 59, 24, '#1b0d24', 372)

@scene(f'{F}-2')
def _():
    u='f2'; b=''
    names = ['dish','clock','coin','apart','loop']
    for i in range(5):
        cx = 120 + i*140; cy = 215
        b += f'<circle cx="{cx}" cy="{cy}" r="58" fill="url(#{u}glow)" opacity=".3"/>'
        b += f'<circle cx="{cx}" cy="{cy}" r="52" fill="#fff3dc"/>'
        if i==0:  # checklist
            b += lines(cx-26, cy-22, [52, 36, 44], '#d9bf99', 17, 8) + f'<circle cx="{cx-34}" cy="{cy-18}" r="0"/>'
            b += f'<path d="M{cx-30} {cy-20} l5 6 l10 -11" stroke="#e5718a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1 -3) scale(.0)"/>'
        elif i==1:
            b += f'<circle cx="{cx}" cy="{cy}" r="30" fill="none" stroke="#b03a60" stroke-width="6"/><path d="M{cx} {cy-16} V{cy} L{cx+12} {cy+8}" stroke="#b03a60" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        elif i==2:
            b += f'<circle cx="{cx}" cy="{cy}" r="28" fill="#f2c777"/><text x="{cx}" y="{cy+12}" font-family="Georgia,serif" font-weight="700" font-size="34" fill="#7a4a1a" text-anchor="middle">$</text>'
        elif i==3:
            b += f'<circle cx="{cx-16}" cy="{cy}" r="19" fill="#e5718a"/><circle cx="{cx+22}" cy="{cy}" r="19" fill="#f2c777" opacity=".95"/>'
        else:
            b += loop_arrow(cx, cy, 24, '#b03a60', 6, 50, -60)
        b += f'<g transform="translate({cx} {cy+86})"><circle r="15" fill="url(#{u}g)"/><text y="6" font-family="Georgia,serif" font-weight="700" font-size="18" fill="#4a2a1a" text-anchor="middle">{i+1}</text></g>'
    b += heart(400, 80, .9, '#e5718a', .9) + spark(90, 90, 1, .9) + spark(720, 90, .9, .9)
    return svg(b, 'plum', u, 61, 18)

@scene(f'{F}-3')
def _():
    u='f3'; b=''
    b += sun(650, 130, 44, u)
    b += loop_arrow(250, 250, 130, '#b03a60', 12, 90, 20)
    b += '<path d="M350 280 Q470 280 520 210 T620 150" stroke="#fbdc9a" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="1 20"/>'
    b += pawn(u, 345, 350, 66, 116, 'g', rot=8)
    b += pawn(u, 175, 350, 56, 96, 'r', rot=-4)
    b += heart(640, 214, .9, '#e5718a') + spark(120, 90, 1, .9) + spark(470, 100, .8, .8) + spark(730, 300, .8, .8)
    return svg(b, 'dawn', u, 67, 12, '#2a1422', 375)

if __name__ == '__main__':
    for name, f in SCENES.items():
        open(f'{OUT}/{name}.svg', 'w').write(f())
    print(len(SCENES), 'scenes')
