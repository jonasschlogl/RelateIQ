"""Three arch-window scenes for the landing page. Characters = two faceless 'pawn' figures (gold + rose)."""
import math, random
W, H = 360, 470
GOLD = ("#fbdc9a", "#e9a766")
ROSE = ("#f2859b", "#b03a60")

def defs(uid):
    return f'''<defs>
<linearGradient id="{uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GOLD[0]}"/><stop offset="1" stop-color="{GOLD[1]}"/></linearGradient>
<linearGradient id="{uid}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ROSE[0]}"/><stop offset="1" stop-color="{ROSE[1]}"/></linearGradient>
<linearGradient id="{uid}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e6"/><stop offset="1" stop-color="#f0dcc0"/></linearGradient>
<radialGradient id="{uid}glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".85"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
<radialGradient id="{uid}rg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f2859b" stop-opacity=".8"/><stop offset="1" stop-color="#f2859b" stop-opacity="0"/></radialGradient>
<linearGradient id="{uid}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7b8" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7b8" stop-opacity=".02"/></linearGradient>
<filter id="{uid}blur"><feGaussianBlur stdDeviation="8"/></filter>
</defs>'''

def pawn(uid, cx, base, w, h, grad, rot=0, shade="#00000022"):
    """body arch + separate round head. (cx, base) = bottom centre."""
    top = base - h
    r = w / 2
    body = f'M{cx-r:.1f} {base} V{top+r:.1f} A{r:.1f} {r:.1f} 0 0 1 {cx+r:.1f} {top+r:.1f} V{base} Z'
    hr = w * 0.3
    hy = top - hr * 0.55
    g = f'<g transform="rotate({rot} {cx} {base})">'
    g += f'<path d="{body}" fill="url(#{uid}{grad})"/>'
    g += f'<path d="M{cx-r:.1f} {base} V{top+r:.1f} A{r:.1f} {r:.1f} 0 0 1 {cx-r*0.35:.1f} {top+r*0.04:.1f} L{cx-r*0.35:.1f} {base} Z" fill="#fff" opacity=".13"/>'
    g += f'<circle cx="{cx}" cy="{hy:.1f}" r="{hr:.1f}" fill="url(#{uid}{grad})"/>'
    g += f'<circle cx="{cx-hr*0.3:.1f}" cy="{hy-hr*0.3:.1f}" r="{hr*0.55:.1f}" fill="#fff" opacity=".14"/>'
    g += '</g>'
    return g

def heart(x, y, s, fill, op=1, rot=0):
    return f'<path d="M0 14 C-22 0 -18 -20 -7 -20 C-2 -20 0 -16 0 -13 C0 -16 2 -20 7 -20 C18 -20 22 0 0 14 Z" transform="translate({x} {y}) rotate({rot}) scale({s})" fill="{fill}" opacity="{op}"/>'

def spark(x, y, s=1, op=1, fill="#fff3d6"):
    return f'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate({x} {y}) scale({s})" fill="{fill}" opacity="{op}"/>'

def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">{body}</svg>'

def stars(uid, seed, n=16, ymax=250):
    rnd = random.Random(seed); out = []
    for _ in range(n):
        out.append(f'<circle cx="{rnd.uniform(10,W-10):.0f}" cy="{rnd.uniform(10,ymax):.0f}" r="{rnd.choice([1,1.2,1.6,2]):.1f}" fill="#fff3d6" opacity="{rnd.uniform(.3,.8):.2f}"/>')
    return ''.join(out)

# ---------- 1. Partner Practice: rehearsal stage with a spotlight
def practice():
    u = 'p'
    b = defs(u)
    b += f'<linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1326"/><stop offset=".6" stop-color="#6e2a49"/><stop offset="1" stop-color="#b9546c"/></linearGradient>'
    b += f'<rect width="{W}" height="{H}" fill="url(#pbg)"/>'
    b += stars(u, 4, 14, 200)
    # spotlight cone
    b += f'<path d="M180 -10 L40 392 L320 392 Z" fill="url(#pbeam)"/>'
    b += f'<ellipse cx="180" cy="392" rx="150" ry="20" fill="#ffe7b8" opacity=".35"/>'
    # stage platform
    b += '<path d="M30 392 H330 V420 Q180 440 30 420 Z" fill="#2a1326" opacity=".55"/>'
    b += '<ellipse cx="180" cy="392" rx="150" ry="16" fill="#3a1a30"/>'
    b += '<ellipse cx="180" cy="390" rx="150" ry="16" fill="url(#pcglow)" opacity="0"/>'
    # figures
    b += pawn(u, 112, 392, 84, 168, 'g', rot=5)
    b += pawn(u, 252, 392, 84, 150, 'r', rot=-5)
    # thinking dots above left, heart above right
    b += '<g transform="translate(80 120)"><rect width="76" height="40" rx="20" fill="#fff6e6"/><circle cx="22" cy="20" r="4.5" fill="#c98a50"/><circle cx="38" cy="20" r="4.5" fill="#c98a50"/><circle cx="54" cy="20" r="4.5" fill="#c98a50"/><path d="M18 38 L12 52 L32 40Z" fill="#fff6e6"/></g>'
    b += '<g transform="translate(200 96)"><rect width="92" height="46" rx="23" fill="url(#pr)"/>' + heart(46, 23, .9, '#fff3f0') + '<path d="M70 44 L82 60 L56 46Z" fill="#cf5876"/></g>'
    b += spark(300, 60, 1.1, .9) + spark(54, 70, .8, .8) + spark(300, 210, .7, .7)
    return svg(b)

# ---------- 2. Message check: a bubble under review
def check():
    u = 'm'
    b = defs(u)
    b += '<linearGradient id="mbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1622"/><stop offset=".55" stop-color="#7a3042"/><stop offset="1" stop-color="#d98a5a"/></linearGradient>'
    b += f'<rect width="{W}" height="{H}" fill="url(#mbg)"/>'
    b += stars(u, 9, 12, 160)
    b += '<circle cx="180" cy="230" r="150" fill="url(#mglow)" opacity=".55"/>'
    # rose figure peeking from the bottom left
    b += pawn(u, 70, 480, 96, 190, 'r', rot=-4)
    b += pawn(u, 300, 480, 90, 150, 'g', rot=5)
    # message bubble
    b += '<g transform="translate(40 118)">'
    b += '<path d="M34 0 H250 Q284 0 284 34 V120 Q284 154 250 154 H92 L40 196 L52 154 H34 Q0 154 0 120 V34 Q0 0 34 0Z" fill="url(#mc)"/>'
    b += '<rect x="28" y="30" width="190" height="11" rx="5.5" fill="#d9bf99"/>'
    b += '<rect x="28" y="56" width="226" height="11" rx="5.5" fill="#d9bf99"/>'
    b += '<rect x="28" y="82" width="120" height="11" rx="5.5" fill="#e5718a" opacity=".85"/>'
    b += '<rect x="156" y="82" width="70" height="11" rx="5.5" fill="#d9bf99"/>'
    b += '<path d="M28 106 q8 -7 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e5718a" stroke-width="2.4" fill="none" stroke-linecap="round" transform="translate(0 -2)"/>'
    # meter
    b += '<rect x="28" y="124" width="228" height="8" rx="4" fill="url(#mmeter)"/>'
    b += '<defs><linearGradient id="mmeter" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbdc9a"/><stop offset=".55" stop-color="#e9a766"/><stop offset="1" stop-color="#e5718a"/></linearGradient></defs>'
    b += '<circle cx="104" cy="128" r="10" fill="#fff" stroke="#2b1622" stroke-width="3"/>'
    b += '</g>'
    # check badge
    b += '<g transform="translate(300 108)"><circle r="30" fill="url(#mg)"/><circle r="30" fill="none" stroke="#fff3d6" stroke-width="3" opacity=".6"/><path d="M-12 1 L-3 10 L13 -9" stroke="#3b1f10" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
    b += spark(46, 90, 1, .9) + spark(318, 250, .8, .8)
    return svg(b)

# ---------- 3. Coach Chat: there at 2am
def coach():
    u = 'c'
    b = defs(u)
    b += '<linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c20"/><stop offset=".6" stop-color="#34193d"/><stop offset="1" stop-color="#8a3a5c"/></linearGradient>'
    b += f'<rect width="{W}" height="{H}" fill="url(#cbg)"/>'
    b += stars(u, 21, 34, 280)
    # moon
    b += '<circle cx="270" cy="96" r="70" fill="url(#cglow)" opacity=".7"/>'
    b += '<path d="M290 52 A46 46 0 1 0 290 140 A38 38 0 1 1 290 52Z" fill="url(#cg)"/>'
    b += spark(210, 60, .9, .9) + spark(318, 168, .7, .8) + spark(60, 130, .8, .8)
    # ground
    b += '<path d="M0 392 Q180 372 360 392 V470 H0Z" fill="#1d0f26" opacity=".75"/>'
    # coach (big, gold) with a warm heart glow, user (small, rose) leaning in
    b += pawn(u, 226, 400, 112, 214, 'g', rot=-2)
    b += '<circle cx="226" cy="312" r="42" fill="url(#crg)" opacity=".9"/>'
    b += heart(226, 316, 1.5, '#b03a60', .95)
    b += pawn(u, 100, 410, 70, 118, 'r', rot=6)
    # tiny memory tags floating between
    b += '<g opacity=".95"><rect x="120" y="214" width="62" height="22" rx="11" fill="#fff6e6"/><rect x="132" y="222" width="38" height="6" rx="3" fill="#d2a773"/></g>'
    b += '<g opacity=".8"><rect x="62" y="262" width="52" height="20" rx="10" fill="#fff6e6"/><rect x="73" y="269" width="30" height="6" rx="3" fill="#e5718a"/></g>'
    return svg(b)

if __name__ == '__main__':
    for n, f in (('practice', practice), ('check', check), ('coach', coach)):
        open(f'/root/lp/scenes/scene-{n}.svg', 'w').write(f())
    print('ok')
