"""Richer flat 2D illustration toolkit: stylised faceless people (varied skin/hair/clothes/poses) + interior props."""
import math, random

SKIN = ['#f4cfae', '#e3a982', '#c27f58', '#8f5a3c', '#f0d9c4']
HAIR = ['#2a1620', '#5b2a2e', '#b0603a', '#e8b86a', '#7a4a3a', '#3a2438']
C = dict(cream='#fff0d8', gold='#f2c777', amber='#e0956a', rose='#e5718a', deep='#b03a60', mauve='#8a4a78',
         plum='#4a2442', blush='#f8b8c0', peach='#f6b793', ink='#2a1424', night='#1c0f24', wine='#7a2a48', sand='#e8cfa8')

def shade(hexc, f):
    h = hexc.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(v + (255 - v) * f) for v in (r, g, b))
    else: r, g, b = (int(v * (1 + f)) for v in (r, g, b))
    return f'#{r:02x}{g:02x}{b:02x}'

def limb(pts, w, col):
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return f'<path d="{d}" stroke="{col}" stroke-width="{w:.1f}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'

def hair_back(cx, hcy, r, style, col):
    if style == 'long':
        return f'<path d="M{cx-r*1.12:.1f} {hcy:.1f} Q{cx-r*1.3:.1f} {hcy+r*2.6:.1f} {cx-r*.5:.1f} {hcy+r*2.7:.1f} L{cx+r*.5:.1f} {hcy+r*2.7:.1f} Q{cx+r*1.3:.1f} {hcy+r*2.6:.1f} {cx+r*1.12:.1f} {hcy:.1f} Z" fill="{col}"/><circle cx="{cx}" cy="{hcy}" r="{r*1.1:.1f}" fill="{col}"/>'
    if style == 'bob':
        return f'<rect x="{cx-r*1.2:.1f}" y="{hcy-r*1.0:.1f}" width="{r*2.4:.1f}" height="{r*2.3:.1f}" rx="{r*1.0:.1f}" fill="{col}"/>'
    if style == 'bun':
        return f'<circle cx="{cx}" cy="{hcy-r*1.25:.1f}" r="{r*.55:.1f}" fill="{col}"/>'
    if style == 'curly':
        o = ''
        for a in range(-160, 20, 30):
            o += f'<circle cx="{cx+r*1.0*math.cos(math.radians(a)):.1f}" cy="{hcy+r*.9*math.sin(math.radians(a)):.1f}" r="{r*.5:.1f}" fill="{col}"/>'
        o += f'<circle cx="{cx-r*1.0:.1f}" cy="{hcy+r*.1:.1f}" r="{r*.5:.1f}" fill="{col}"/><circle cx="{cx+r*1.0:.1f}" cy="{hcy+r*.1:.1f}" r="{r*.5:.1f}" fill="{col}"/>'
        return o
    return ''
def hair_front(cx, hcy, r, style, col):
    if style in ('short', 'bun', 'long', 'bob'):
        side = 1 if style != 'short' else 0
        return f'<path d="M{cx-r*1.03:.1f} {hcy+r*.1:.1f} A{r*1.03:.1f} {r*1.05:.1f} 0 0 1 {cx+r*1.03:.1f} {hcy+r*.1:.1f} Q{cx+r*.4:.1f} {hcy-r*.5:.1f} {cx-r*.1:.1f} {hcy-r*.45:.1f} Q{cx-r*.7:.1f} {hcy-r*.3:.1f} {cx-r*1.03:.1f} {hcy+r*.1:.1f}Z" fill="{col}"/>'
    if style == 'curly':
        return f'<path d="M{cx-r*.95:.1f} {hcy-r*.1:.1f} A{r:.1f} {r:.1f} 0 0 1 {cx+r*.95:.1f} {hcy-r*.1:.1f} Q{cx:.1f} {hcy-r*.7:.1f} {cx-r*.95:.1f} {hcy-r*.1:.1f}Z" fill="{col}"/>'
    return ''

def person(cx, hy, s=1.0, skin=0, hair=0, style='short', top='rose', bottom='plum', dress=False,
           la=((-14, 24), (-8, 50)), ra=((14, 24), (8, 50)), ll=((-9, 38), (-10, 78)), rl=((9, 38), (10, 78)),
           tilt=0, lean=0, sleeve='long', shoe='ink', flip=False, shadow=True):
    """hy = hip centre y. Standing person ~170*s tall. Offsets (x,y) are in units of s, relative to shoulder/hip."""
    S = lambda v: v * s
    skin_c = SKIN[skin] if isinstance(skin, int) else skin
    hair_c = HAIR[hair] if isinstance(hair, int) else hair
    top_c = C.get(top, top); bot_c = C.get(bottom, bottom); shoe_c = C.get(shoe, shoe)
    g = f'<g transform="translate({cx} {hy}) scale({-1 if flip else 1} 1) translate({-cx} {-hy})">'
    if shadow:
        g += f'<ellipse cx="{cx}" cy="{hy+S(80):.1f}" rx="{S(34):.1f}" ry="{S(6):.1f}" fill="#000" opacity=".28"/>'
    g += f'<g transform="rotate({lean} {cx} {hy})">'
    shx = (cx - S(21), hy - S(64)); shx2 = (cx + S(21), hy - S(64))
    r = S(15.5); hcy = hy - S(86)
    g += f'<g transform="rotate({tilt} {cx} {hcy + r:.1f})">' + hair_back(cx, hcy, r, style, hair_c) + '</g>'
    # legs
    for (hip, (k, f)) in ((cx - S(9), ll), (cx + S(9), rl)):
        pts = [(hip, hy - S(2)), (hip + S(k[0] - (-9 if hip < cx else 9)), hy + S(k[1])), (hip + S(f[0] - (-9 if hip < cx else 9)), hy + S(f[1]))]
        # relative offsets already given from the hip centre, so recompute simply
        kx = cx + S(k[0]); ky = hy + S(k[1]); fx = cx + S(f[0]); fy = hy + S(f[1])
        g += limb([(hip, hy - S(2)), (kx, ky), (fx, fy)], S(14.5), bot_c)
        g += f'<ellipse cx="{fx + S(3 if not flip else -3):.1f}" cy="{fy + S(2):.1f}" rx="{S(9):.1f}" ry="{S(4.6):.1f}" fill="{shoe_c}"/>'
    # back arm
    def arm(sh, off):
        (ex, ey), (hx, hy_) = off
        e = (sh[0] + S(ex), sh[1] + S(ey)); h = (sh[0] + S(hx), sh[1] + S(hy_))
        a = limb([sh, e], S(11.5), top_c)
        a += limb([e, h], S(10.5), top_c if sleeve == 'long' else skin_c)
        a += f'<circle cx="{h[0]:.1f}" cy="{h[1]:.1f}" r="{S(5.6):.1f}" fill="{skin_c}"/>'
        return a
    g += arm(shx, la)
    # torso
    if dress:
        pts = [(cx - S(20), hy - S(64)), (cx + S(20), hy - S(64)), (cx + S(30), hy + S(34)), (cx - S(30), hy + S(34))]
    else:
        pts = [(cx - S(20), hy - S(62)), (cx + S(20), hy - S(62)), (cx + S(15), hy + S(2)), (cx - S(15), hy + S(2))]
    g += f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)}Z" fill="{top_c}" stroke="{top_c}" stroke-width="{S(12):.1f}" stroke-linejoin="round"/>'
    g += f'<path d="M{pts[0][0]:.1f} {pts[0][1]:.1f} L{pts[3][0]:.1f} {pts[3][1]:.1f}" stroke="#fff" stroke-opacity=".16" stroke-width="{S(10):.1f}" stroke-linecap="round"/>'
    if not dress:
        g += f'<rect x="{cx - S(17):.1f}" y="{hy - S(10):.1f}" width="{S(34):.1f}" height="{S(16):.1f}" rx="{S(6):.1f}" fill="{bot_c}"/>'
    g += arm(shx2, ra)
    # neck + head
    g += f'<rect x="{cx - S(5.5):.1f}" y="{hy - S(78):.1f}" width="{S(11):.1f}" height="{S(18):.1f}" rx="{S(5):.1f}" fill="{shade(skin_c, -.12)}"/>'
    g += f'<g transform="rotate({tilt} {cx} {hcy + r:.1f})">'
    g += f'<circle cx="{cx}" cy="{hcy:.1f}" r="{r:.1f}" fill="{skin_c}"/>'
    g += f'<circle cx="{cx - r*.35:.1f}" cy="{hcy + r*.35:.1f}" r="{r*.55:.1f}" fill="{shade(skin_c, .1)}" opacity=".35"/>'
    g += hair_front(cx, hcy, r, style, hair_c)
    g += '</g></g></g>'
    return g

def sitting(cx, hy, s=1.0, facing=1, **kw):
    kw.setdefault('shadow', False)
    """sitting on a seat at height hy (hip centre). thighs go horizontally forward."""
    k = 34 * facing
    kw.setdefault('ll', ((-9 + k * .55, 6), (-9 + k, 52))); kw.setdefault('rl', ((9 + k * .6, 6), (9 + k * 1.05, 52)))
    return person(cx, hy, s, **kw)

# ---------- props
def glow(x, y, r, col='#ffd9a0', op=.6, uid='gl'):
    return f'<radialGradient id="{uid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{col}" stop-opacity="{op}"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient><circle cx="{x}" cy="{y}" r="{r}" fill="url(#{uid})"/>'

def lin(uid, c0, c1, vertical=True):
    return f'<linearGradient id="{uid}" x1="0" y1="0" x2="{0 if vertical else 1}" y2="{1 if vertical else 0}"><stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>'

def star_field(seed, n, x0, y0, x1, y1):
    rnd = random.Random(seed); o = ''
    for _ in range(n):
        o += f'<circle cx="{rnd.uniform(x0,x1):.0f}" cy="{rnd.uniform(y0,y1):.0f}" r="{rnd.choice([.8,1.1,1.5,2]):.1f}" fill="#fff3d6" opacity="{rnd.uniform(.3,.85):.2f}"/>'
    return o

def spark(x, y, s=1, op=1, fill='#fff3d6'):
    return f'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate({x} {y}) scale({s})" fill="{fill}" opacity="{op}"/>'

def heart(x, y, s, fill, op=1, rot=0):
    return f'<path d="M0 14 C-22 0 -18 -20 -7 -20 C-2 -20 0 -16 0 -13 C0 -16 2 -20 7 -20 C18 -20 22 0 0 14 Z" transform="translate({x} {y}) rotate({rot}) scale({s})" fill="{fill}" opacity="{op}"/>'

def window_arch(x, y, w, h, uid, sky=('#1b1030', '#5a2850', '#e8946c'), moon=True, frame='#3a1c34', seed=3, city=True):
    """arched window with night/dusk sky; (x,y) top-left."""
    r = w / 2
    cid = f'{uid}c'
    o = f'<clipPath id="{cid}"><path d="M{x} {y+h} V{y+r} A{r} {r} 0 0 1 {x+w} {y+r} V{y+h}Z"/></clipPath>'
    o += lin(f'{uid}s', *[sky[0], sky[2]])
    o += f'<path d="M{x-8} {y+h+8} V{y+r} A{r+8} {r+8} 0 0 1 {x+w+8} {y+r} V{y+h+8}Z" fill="{frame}"/>'
    o += f'<g clip-path="url(#{cid})"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{uid}s)"/>'
    o += star_field(seed, 14, x, y, x + w, y + h * .6)
    if moon:
        mx, my, mr = x + w * .68, y + h * .26, w * .12
        o += f'<circle cx="{mx}" cy="{my}" r="{mr*2.3}" fill="#ffd9a0" opacity=".16"/><circle cx="{mx}" cy="{my}" r="{mr}" fill="#ffe3b0"/><circle cx="{mx+mr*.5}" cy="{my-mr*.25}" r="{mr*.85}" fill="{sky[0]}" opacity=".0"/>'
    if city:
        rnd = random.Random(seed + 5); bx = x
        while bx < x + w:
            bw = rnd.uniform(w * .08, w * .17); bh = rnd.uniform(h * .12, h * .3)
            o += f'<rect x="{bx:.0f}" y="{y+h-bh:.0f}" width="{bw:.0f}" height="{bh:.0f}" fill="#2a1430"/>'
            for _ in range(3):
                o += f'<rect x="{bx+rnd.uniform(3,bw-8):.0f}" y="{y+h-bh+rnd.uniform(6,bh-10):.0f}" width="4" height="5" fill="#ffd9a0" opacity="{rnd.choice([0,.8,.9])}"/>'
            bx += bw + 3
    o += '</g>'
    o += f'<path d="M{x+r} {y} V{y+h}" stroke="{frame}" stroke-width="5"/><path d="M{x} {y+h*.5} H{x+w}" stroke="{frame}" stroke-width="5"/>'
    return o

def sofa(x, y, w, col, uid='sf', h=70):
    """x,y = left/top of backrest; w = width."""
    d = shade(col, -.22); l = shade(col, .12)
    o = f'<rect x="{x}" y="{y}" width="{w}" height="{h*.8}" rx="{h*.3}" fill="{d}"/>'
    o += f'<rect x="{x-12}" y="{y+h*.45}" width="{w+24}" height="{h*.55}" rx="{h*.22}" fill="{col}"/>'
    o += f'<rect x="{x+10}" y="{y+h*.45}" width="{w-20}" height="{h*.34}" rx="{h*.14}" fill="{l}" opacity=".55"/>'
    o += f'<rect x="{x-6}" y="{y+h*.98}" width="10" height="12" rx="3" fill="#2a1424"/><rect x="{x+w-4}" y="{y+h*.98}" width="10" height="12" rx="3" fill="#2a1424"/>'
    return o

def lamp(x, y, h, uid, shade_col='#f6c790', glow_r=140):
    o = f'<circle cx="{x}" cy="{y}" r="{glow_r}" fill="url(#{uid}lg)"/>'
    o += f'<defs><radialGradient id="{uid}lg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient></defs>'
    o += f'<rect x="{x-2.5}" y="{y}" width="5" height="{h}" fill="#2a1424"/><ellipse cx="{x}" cy="{y+h}" rx="18" ry="4" fill="#2a1424"/>'
    o += f'<path d="M{x-24} {y+2} L{x-14} {y-30} H{x+14} L{x+24} {y+2}Z" fill="{shade_col}"/><path d="M{x-24} {y+2} L{x-14} {y-30} H{x-4} L{x-10} {y+2}Z" fill="#fff" opacity=".25"/>'
    return o

def plant(x, y, s, pot='#c8705a', leaf=('#e5718a', '#f0a070', '#d85a7a'), seed=1):
    rnd = random.Random(seed)
    o = f'<path d="M{x-16*s} {y-26*s} H{x+16*s} L{x+11*s} {y} H{x-11*s}Z" fill="{pot}"/><rect x="{x-18*s}" y="{y-30*s}" width="{36*s}" height="{7*s}" rx="{3*s}" fill="{shade(pot,.15)}"/>'
    for i in range(7):
        a = -90 + rnd.uniform(-60, 60); L = rnd.uniform(40, 70) * s
        ex = x + L * math.cos(math.radians(a)); ey = y - 30 * s + L * math.sin(math.radians(a))
        col = leaf[i % len(leaf)]
        mx, my = (x + ex) / 2, (y - 30 * s + ey) / 2
        nx, ny = -math.sin(math.radians(a)) * 9 * s, math.cos(math.radians(a)) * 9 * s
        o += f'<path d="M{x} {y-30*s} Q{mx+nx:.1f} {my+ny:.1f} {ex:.1f} {ey:.1f} Q{mx-nx:.1f} {my-ny:.1f} {x} {y-30*s}Z" fill="{col}"/>'
    return o

def phone(x, y, w, h, uid, rot=0, screen='#2c1a30'):
    o = f'<g transform="rotate({rot} {x+w/2} {y+h/2})">'
    o += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w*.15}" fill="#150b14" stroke="#7a5a6c" stroke-width="2"/>'
    o += f'<rect x="{x+5}" y="{y+6}" width="{w-10}" height="{h-12}" rx="{w*.11}" fill="{screen}"/>'
    o += f'<rect x="{x+w/2-w*.14}" y="{y+9}" width="{w*.28}" height="5" rx="2.5" fill="#150b14"/>'
    return o  # caller closes </g>

def bubble(x, y, w, h, fill='#fff3dc', tail='l', r=None):
    r = r if r is not None else min(h / 2, 22)
    o = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"/>'
    if tail == 'l': o += f'<path d="M{x+r*.7:.1f} {y+h-2} L{x+r*.2:.1f} {y+h+15} L{x+r*1.8:.1f} {y+h-2}Z" fill="{fill}"/>'
    if tail == 'r': o += f'<path d="M{x+w-r*.7:.1f} {y+h-2} L{x+w-r*.2:.1f} {y+h+15} L{x+w-r*1.8:.1f} {y+h-2}Z" fill="{fill}"/>'
    return o
def txtlines(x, y, ws, col='#d9bf99', gap=16, h=8):
    return ''.join(f'<rect x="{x}" y="{y+i*gap}" width="{w}" height="{h}" rx="{h/2}" fill="{col}"/>' for i, w in enumerate(ws))
def dots3(x, y, col='#c98a50', r=4.4, gap=15):
    return ''.join(f'<circle cx="{x+i*gap}" cy="{y}" r="{r}" fill="{col}"/>' for i in range(3))
def cup(x, y, s=1, col='#fff0d8', steam=True):
    o = f'<path d="M{x-11*s} {y-14*s} H{x+11*s} L{x+9*s} {y} H{x-9*s}Z" fill="{col}"/><path d="M{x+11*s} {y-10*s} q{9*s} 1 {6*s} {8*s} q{-2*s} {3*s} {-8*s} {3*s}" stroke="{col}" stroke-width="{3*s}" fill="none"/>'
    if steam: o += f'<path d="M{x-4*s} {y-20*s} q{-4*s} {-6*s} 0 {-12*s} M{x+4*s} {y-20*s} q{-4*s} {-6*s} 0 {-12*s}" stroke="#fff0d8" stroke-width="{2*s}" fill="none" stroke-linecap="round" opacity=".6"/>'
    return o
def rug(x, y, w, h, col):
    return f'<ellipse cx="{x}" cy="{y}" rx="{w/2}" ry="{h/2}" fill="{col}"/><ellipse cx="{x}" cy="{y}" rx="{w/2-12}" ry="{h/2-5}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>'
def frame_pic(x, y, w, h, c1, c2, uid):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="#2a1424"/>' + lin(uid, c1, c2) + f'<rect x="{x+4}" y="{y+4}" width="{w-8}" height="{h-8}" rx="2" fill="url(#{uid})"/>'
def pillow(x, y, w, col, rot=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{w*.9}" rx="{w*.28}" fill="{col}" transform="rotate({rot} {x+w/2} {y+w*.45})"/>'
def curtain(x, y, w, h, col, side='l'):
    o = ''
    for i in range(4):
        o += f'<path d="M{x+i*w/4:.1f} {y} h{w/4:.1f} v{h} q{-w/8:.1f} 10 {-w/4:.1f} 0z" fill="{shade(col, .08*(i%2)-.05)}"/>'
    return o

def wrap(body, w, h, uid, bg0, bg1, bg2=None, extra_defs=''):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice"><defs>'
    s += f'<linearGradient id="{uid}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg0}"/>' + (f'<stop offset=".55" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/>' if bg2 else f'<stop offset="1" stop-color="{bg1}"/>') + '</linearGradient>'
    s += extra_defs + '</defs>'
    s += f'<rect width="{w}" height="{h}" fill="url(#{uid}bg)"/>' + body + '</svg>'
    return s
