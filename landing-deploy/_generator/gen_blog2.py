import sys, math; sys.path.insert(0,'/root/lp')
from art2 import *
W,H=800,450
OUT='/root/lp/blogimg2'
S={}
def sc(name):
    def d(f): S[name]=f; return f
    return d
A='2026-10-08-how-attachment-styles-work-in-relationships'; B='2026-10-08-how-to-apologize-to-your-partner'
Cc='2026-10-04-how-to-fix-a-relationship'; D='2026-10-08-how-to-stop-overthinking-in-a-relationship'
E='2026-10-05-relationship-advice-communication-habits'; F='2026-10-03-relationship-problems-that-keep-coming-back'

def floor(fy, c0='#2a1430', c1='#150a18'):
    return lin('fl'+str(fy), c0, c1) + f'<path d="M0 {fy} Q{W/2} {fy-10} {W} {fy} V{H} H0Z" fill="url(#fl{fy})"/>'
import math
def tile(x, y, w, h, uid, sky, content, frame='#3a1c34'):
    """arched mini-window with content drawn inside (clip)."""
    r = w/2
    o = f'<clipPath id="{uid}c"><path d="M{x} {y+h} V{y+r} A{r} {r} 0 0 1 {x+w} {y+r} V{y+h}Z"/></clipPath>' + lin(uid+'s', sky[0], sky[1])
    o += f'<path d="M{x-6} {y+h+6} V{y+r} A{r+6} {r+6} 0 0 1 {x+w+6} {y+r} V{y+h+6}Z" fill="{frame}"/>'
    o += f'<g clip-path="url(#{uid}c)"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{uid}s)"/>{content}</g>'
    return o

# ============ A: attachment styles
@sc(f'{A}-1')
def _():
    u='a1'; b=''
    b += star_field(3, 22, 0, 0, W, 120)
    ws, ys, hh = 156, 70, 310
    xs = [38 + i*190 for i in range(4)]
    # 1 secure: two people on a bench sharing tea, warm
    c = f'<rect x="{xs[0]}" y="{ys+hh-60}" width="{ws}" height="60" fill="#3a1830"/>'
    c += f'<circle cx="{xs[0]+ws/2}" cy="{ys+100}" r="60" fill="#ffd9a0" opacity=".25"/>'
    c += f'<rect x="{xs[0]+16}" y="{ys+hh-96}" width="{ws-32}" height="14" rx="6" fill="#8a3a5a"/><rect x="{xs[0]+24}" y="{ys+hh-82}" width="8" height="26" fill="#2a1424"/><rect x="{xs[0]+ws-32}" y="{ys+hh-82}" width="8" height="26" fill="#2a1424"/>'
    c += sitting(xs[0]+50, ys+hh-92, .8, facing=1, skin=1, hair=0, style='bun', top='rose', bottom='plum', la=((-4,26),(14,14)), ra=((6,28),(20,22)), tilt=6)
    c += sitting(xs[0]+108, ys+hh-92, .8, facing=-1, skin=0, hair=2, style='short', top='gold', bottom='mauve', la=((-6,28),(-20,20)), ra=((4,26),(-14,14)), tilt=-6)
    c += heart(xs[0]+ws/2, ys+88, .8, '#e5718a') + spark(xs[0]+30, ys+60, .7, .8)
    b += tile(xs[0], ys, ws, hh, 'a1a', ('#40203a','#b0605a'), c)
    # 2 anxious: person on floor with phone, dots bubble
    c = f'<rect x="{xs[1]}" y="{ys+hh-50}" width="{ws}" height="50" fill="#26122a"/>'
    c += f'<rect x="{xs[1]-10}" y="{ys+hh-120}" width="{ws*.55}" height="90" rx="10" fill="#7a2a48"/><rect x="{xs[1]-10}" y="{ys+hh-120}" width="{ws*.55}" height="20" rx="8" fill="#9a3a5c"/>'
    c += sitting(xs[1]+96, ys+hh-56, .82, facing=-1, skin=3, hair=5, style='curly', top='cream', bottom='deep', ll=((-30,-26),(-52,6)), rl=((-26,-22),(-46,8)), la=((-8,24),(-26,10)), ra=((2,26),(-22,12)), tilt=-6)
    c += phone(xs[1]+34, ys+hh-146, 16, 28, 'a1p', -12) + '</g>'
    c += bubble(xs[1]+70, ys+80, 64, 34, '#fff3dc', 'l') + dots3(xs[1]+88, ys+97)
    c += f'<circle cx="{xs[1]+40}" cy="{ys+60}" r="30" fill="#ffd9a0" opacity=".14"/>'
    b += tile(xs[1], ys, ws, hh, 'a1b', ('#150b22','#4a2048'), c)
    # 3 avoidant: headphones, wall
    c = f'<rect x="{xs[2]}" y="{ys+hh-60}" width="{ws}" height="60" fill="#2a1430"/>'
    c += f'<rect x="{xs[2]+ws*.46}" y="{ys+40}" width="22" height="{hh-40}" fill="#4a2442"/><rect x="{xs[2]+ws*.46}" y="{ys+40}" width="22" height="10" fill="#5e3252"/>'
    c += person(xs[2]+ws*.74, ys+hh-84, .82, skin=2, hair=0, style='short', top='mauve', bottom='ink', la=((-14,18),(10,34)), ra=((14,18),(-10,34)), tilt=-4, flip=False)
    hx, hy = xs[2]+ws*.74, ys+hh-84-86*.82
    c += f'<path d="M{hx-13} {hy} A13 13 0 0 1 {hx+13} {hy}" stroke="#f2c777" stroke-width="3" fill="none"/><circle cx="{hx-13}" cy="{hy+2}" r="4.5" fill="#f2c777"/><circle cx="{hx+13}" cy="{hy+2}" r="4.5" fill="#f2c777"/>'
    c += f'<g opacity=".55">{heart(xs[2]+30, ys+hh-120, .55, "#e5718a")}</g>'
    c += bubble(xs[2]+14, ys+88, 60, 30, '#fff3dc', 'r') + txtlines(xs[2]+26, ys+98, [34], '#d9bf99', 10, 7)
    b += tile(xs[2], ys, ws, hh, 'a1c', ('#201030','#5a2850'), c)
    # 4 fearful: two doors, person between with hands up
    c = f'<rect x="{xs[3]}" y="{ys+hh-60}" width="{ws}" height="60" fill="#2a1430"/>'
    c += f'<rect x="{xs[3]+12}" y="{ys+100}" width="46" height="{hh-160}" rx="4" fill="#f2c777"/><rect x="{xs[3]+16}" y="{ys+106}" width="38" height="{hh-172}" fill="#fff0c8"/>'
    c += f'<rect x="{xs[3]+ws-58}" y="{ys+100}" width="46" height="{hh-160}" rx="4" fill="#7a2a48"/><circle cx="{xs[3]+ws-24}" cy="{ys+hh-110}" r="3.5" fill="#f2c777"/>'
    c += person(xs[3]+ws/2, ys+hh-84, .8, skin=4, hair=3, style='long', top='deep', bottom='plum', la=((-22,6),(-30,-18)), ra=((22,6),(30,-18)), tilt=0)
    c += f'<path d="M{xs[3]+ws/2-30} {ys+60} h-24 M{xs[3]+ws/2-54} {ys+60} l8 -7 M{xs[3]+ws/2-54} {ys+60} l8 7 M{xs[3]+ws/2+30} {ys+60} h24 M{xs[3]+ws/2+54} {ys+60} l-8 -7 M{xs[3]+ws/2+54} {ys+60} l-8 7" stroke="#fbdc9a" stroke-width="4" stroke-linecap="round" fill="none"/>'
    b += tile(xs[3], ys, ws, hh, 'a1d', ('#1c1030','#6a2c58'), c)
    b += spark(20, 40, 1, .9) + spark(780, 50, .9, .8)
    return wrap(b, W, H, u, '#140a20', '#2a1440', '#5a2850')

@sc(f'{A}-2')
def _():
    u='a2'; b=''
    b += window_arch(560, 36, 150, 240, u, sky=('#120a20','#34184a','#7a3560'), seed=8)
    b += floor(330)
    # bed against left
    b += f'<rect x="40" y="250" width="330" height="140" rx="22" fill="#7a2a48"/><rect x="40" y="250" width="330" height="40" rx="18" fill="#9a3a5c"/><rect x="60" y="226" width="110" height="46" rx="20" fill="#f8b8c0"/><rect x="40" y="380" width="14" height="22" fill="#2a1424"/><rect x="356" y="380" width="14" height="22" fill="#2a1424"/>'
    b += rug(470, 410, 360, 50, '#4a2050')
    # person on floor leaning on the bed
    b += sitting(430, 372, 1.32, facing=1, skin=1, hair=1, style='long', top='cream', bottom='mauve', ll=((38,-26),(70,4)), rl=((34,-20),(62,8)), la=((18,22),(46,-14)), ra=((26,26),(50,-8)), tilt=8)
    b += f'<circle cx="500" cy="318" r="70" fill="#9ad8ff" opacity=".12"/>'
    b += phone(486, 314, 28, 48, u, 16, '#e8f4ff') + '</g>'
    # side table + clock
    b += f'<rect x="640" y="290" width="90" height="12" rx="5" fill="#4a2442"/><rect x="650" y="302" width="8" height="90" fill="#4a2442"/><rect x="712" y="302" width="8" height="90" fill="#4a2442"/>'
    b += '<rect x="650" y="262" width="74" height="30" rx="10" fill="#fff3dc"/><text x="687" y="284" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="19" fill="#6a3a2a" text-anchor="middle">11:47</text>'
    # floating chat
    b += bubble(300, 70, 150, 50, '#fff3dc', 'l') + dots3(344, 95, r=5)
    b += bubble(330, 140, 120, 44, '#e5718a', 'r') + txtlines(350, 158, [78], '#ffe9ee', 10, 8)
    b += bubble(300, 204, 80, 38, '#fff3dc', 'l') + dots3(318, 223)
    b += heart(260, 120, .7, '#e5718a', .9) + spark(60, 90, 1, .9) + spark(520, 110, .8, .8)
    return wrap(b, W, H, u, '#140a20', '#301640', '#6a2c58')

@sc(f'{A}-3')
def _():
    u='a3'; b=''
    b += lin('a3sun','#3a1a34','#e8946c')
    b += f'<rect width="{W}" height="{H}" fill="url(#a3sun)"/>' if False else ''
    b += f'<circle cx="170" cy="150" r="130" fill="#ffd9a0" opacity=".18"/><circle cx="170" cy="150" r="46" fill="#ffe3b0"/>'
    b += star_field(5, 10, 300, 10, 790, 120)
    b += f'<rect x="60" y="300" width="680" height="16" rx="6" fill="#6a3258"/><rect x="80" y="316" width="10" height="90" fill="#4a2442"/><rect x="710" y="316" width="10" height="90" fill="#4a2442"/>'
    b += floor(400)
    # three pots: seedling, medium, big
    def pot(x, c): return f'<path d="M{x-34} 262 H{x+34} L{x+26} 300 H{x-26}Z" fill="{c}"/><rect x="{x-38}" y="254" width="76" height="12" rx="5" fill="{shade(c,.15)}"/>'
    b += pot(270, '#c8705a')
    b += f'<path d="M270 254 Q270 232 274 222" stroke="#f0a070" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M274 224 q16 -14 24 -2 q-12 12 -24 2z" fill="#f0a070"/><path d="M272 230 q-14 -12 -22 -2 q10 12 22 2z" fill="#e5718a"/>'
    b += pot(400, '#b8506a')
    b += '<path d="M400 254 Q398 200 402 160" stroke="#f0a070" stroke-width="5" fill="none" stroke-linecap="round"/>'
    for (dx,dy,col,rot) in [(14,-6,'#e5718a',-20),(-16,10,'#f0a070',200),(16,34,'#d85a7a',-10),(-18,52,'#e5718a',190),(0,-24,'#f8b8c0',-90)]:
        b += f'<path d="M402 {160+(dy+10)} q{dx*1.8} -24 {dx*3} 0 q{-dx*1.2} 22 {-dx*3} 0z" fill="{col}" transform="rotate({rot} 402 {170+dy})"/>'
    b += pot(540, '#d8805a')
    b += '<path d="M540 254 Q534 190 546 110" stroke="#f0a070" stroke-width="7" fill="none" stroke-linecap="round"/>'
    import random as R; rnd=R.Random(4)
    for i in range(12):
        t=i/11; y=250-t*150; x=540+(-8 if i%2 else 10)+rnd.uniform(-6,6); sdir=-1 if i%2 else 1
        col=['#e5718a','#f0a070','#d85a7a','#f8b8c0'][i%4]
        b += f'<path d="M{540+ (t*6)} {y} q{sdir*40} -26 {sdir*70*(1-t*.3)} {-4} q{-sdir*34} 30 {-sdir*70*(1-t*.3)} {4}z" fill="{col}"/>'
    b += heart(560, 84, .9, '#f2c777') + spark(620, 120, .9, .9) + spark(330, 200, .8, .9)
    # person with watering can
    b += person(180, 318, 1.5, skin=4, hair=1, style='bun', top='gold', bottom='deep', la=((-16,28),(-10,52)), ra=((26,6),(60,-4)), tilt=-4, lean=0)
    b += f'<g><rect x="222" y="260" width="48" height="36" rx="8" fill="#e5718a"/><path d="M222 270 L190 248 L194 256 L222 280" fill="#e5718a"/><path d="M262 262 q22 0 22 18 q0 10 -14 10" stroke="#b03a60" stroke-width="5" fill="none"/>'
    b += '<path d="M268 296 q4 20 -2 30 M280 290 q6 22 2 34 M256 294 q2 18 -4 28" stroke="#9ad8ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/></g>'
    return wrap(b, W, H, u, '#32162c', '#6a2c4c', '#e8946c')

# ============ B: apologize
@sc(f'{B}-1')
def _():
    u='b1'; b=''
    b += window_arch(310, 30, 180, 250, u, sky=('#2a1430','#7a3050','#f0b080'), seed=11, moon=False)
    b += floor(340)
    b += f'<circle cx="150" cy="60" r="0"/>'
    for x in (150, 650):
        b += f'<rect x="{x-1.5}" y="0" width="3" height="60" fill="#2a1424"/><path d="M{x-26} 92 L{x-14} 60 H{x+14} L{x+26} 92Z" fill="#f6c790"/><circle cx="{x}" cy="100" r="90" fill="#ffd9a0" opacity=".16"/>'
    # table
    b += f'<ellipse cx="400" cy="392" rx="210" ry="22" fill="#000" opacity=".25"/><rect x="190" y="316" width="420" height="16" rx="7" fill="#9a4a5c"/><rect x="396" y="332" width="10" height="62" fill="#4a2442"/>'
    b += sitting(250, 330, 1.3, facing=1, skin=2, hair=0, style='short', top='rose', bottom='plum', la=((6,28),(30,8)), ra=((18,30),(48,2)), tilt=4, ll=((24,4),(30,40)), rl=((34,6),(40,42)))
    b += sitting(560, 330, 1.3, facing=-1, skin=0, hair=3, style='long', top='gold', bottom='mauve', la=((-6,26),(-24,16)), ra=((-4,30),(-20,24)), tilt=-5, ll=((-24,4),(-30,40)), rl=((-34,6),(-40,42)))
    # heart note offered across the table
    b += f'<circle cx="406" cy="272" r="44" fill="#ffd9a0" opacity=".3"/>' + heart(406, 276, 1.6, '#e5718a') + heart(406, 276, 1.0, '#ffe3e8', .9)
    b += cup(330, 316, 1.1) + cup(480, 316, 1.1)
    b += spark(120, 150, 1, .9) + spark(700, 160, 1, .9) + spark(406, 210, .8, .8)
    return wrap(b, W, H, u, '#241026', '#5e2448', '#b0605a')

@sc(f'{B}-2')
def _():
    u='b2'; b=''
    b += lin('b2d','#6a3252','#4a2040') + f'<rect width="{W}" height="{H}" fill="url(#b2d)"/>'
    for i in range(0, W, 90): b += f'<path d="M{i} 0 V{H}" stroke="#fff" stroke-opacity=".04" stroke-width="2"/>'
    b += f'<circle cx="560" cy="120" r="200" fill="#ffd9a0" opacity=".1"/>'
    b += '<g transform="rotate(-4 330 230)"><rect x="150" y="50" width="360" height="350" rx="10" fill="#000" opacity=".25" transform="translate(8 10)"/><rect x="150" y="50" width="360" height="350" rx="10" fill="#fff3dc"/>'
    for i in range(0,350,24): b += f'<path d="M150 {74+i} H510" stroke="#e8d4b4" stroke-width="1.5"/>'
    b += '<path d="M200 50 V400" stroke="#e5718a" stroke-opacity=".35" stroke-width="2"/>'
    rows = [(104,[170,110]),(190,[200,120]),(276,[140,170])]
    for i,(y,ws) in enumerate(rows):
        b += f'<circle cx="236" cy="{y+14}" r="22" fill="#f2c777"/><text x="236" y="{y+22}" font-family="Georgia,serif" font-weight="700" font-size="26" fill="#6a3a2a" text-anchor="middle">{i+1}</text>'
        b += txtlines(276, y, [ws[0]+30], '#c9a97c', 18, 10) + txtlines(276, y+22, [ws[1]+40], '#e5718a' if i==0 else '#c9a97c', 18, 10)
        b += f'<path d="M{480} {y+14} l8 9 l16 -18" stroke="#e5718a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(-14 0)"/>'
    b += '</g>'
    # pen, mug, flower, candle
    b += '<g transform="rotate(32 560 300)"><rect x="470" y="288" width="170" height="14" rx="7" fill="#f2c777"/><path d="M640 288 L668 295 L640 302Z" fill="#fff3dc"/><rect x="470" y="288" width="40" height="14" rx="7" fill="#b03a60"/></g>'
    b += f'<ellipse cx="660" cy="130" rx="60" ry="14" fill="#000" opacity=".2"/><circle cx="660" cy="118" r="52" fill="#fff0d8"/><circle cx="660" cy="118" r="40" fill="#8a4a38"/><path d="M712 118 q30 0 30 22 q0 22 -30 22" stroke="#fff0d8" stroke-width="10" fill="none"/>'
    b += f'<g transform="translate(120 380)"><circle r="46" fill="#ffd9a0" opacity=".2"/><rect x="-14" y="-22" width="28" height="40" rx="6" fill="#fff0d8"/><path d="M0 -26 q-8 -14 0 -26 q8 12 0 26z" fill="#f6b04a"/></g>'
    b += f'<g transform="translate(700 350)"><path d="M0 0 q-6 -50 4 -90" stroke="#d8805a" stroke-width="5" fill="none"/><circle cx="4" cy="-96" r="24" fill="#e5718a"/><circle cx="4" cy="-96" r="9" fill="#f2c777"/><circle cx="-18" cy="-86" r="14" fill="#f8b8c0"/><circle cx="26" cy="-84" r="14" fill="#f8b8c0"/></g>'
    # hand with sleeve writing
    b += f'<path d="M820 360 L610 250" stroke="#b03a60" stroke-width="64" stroke-linecap="round"/><path d="M640 262 L590 232" stroke="{SKIN[1]}" stroke-width="34" stroke-linecap="round"/><circle cx="578" cy="226" r="20" fill="{SKIN[1]}"/>'
    return wrap(b, W, H, u, '#4a2040', '#4a2040')

@sc(f'{B}-3')
def _():
    u='b3'; b=''
    b += f'<circle cx="400" cy="270" r="260" fill="#ffd9a0" opacity=".16"/><circle cx="400" cy="270" r="150" fill="#ffd9a0" opacity=".18"/><circle cx="400" cy="270" r="84" fill="#ffe8b8"/>'
    for bx,by in [(130,120),(190,90),(640,100),(690,140)]:
        b += f'<path d="M{bx} {by} q8 -10 16 0 q8 -10 16 0" stroke="#4a2040" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    b += f'<path d="M0 330 Q220 270 420 320 T800 300 V450 H0Z" fill="#8a3a50"/><path d="M0 372 Q240 330 440 364 T800 350 V450 H0Z" fill="#4a2042"/><path d="M0 410 Q300 380 800 404 V450 H0Z" fill="#26122a"/>'
    # two people hugging
    b += person(372, 292, 1.75, skin=2, hair=0, style='short', top='cream', bottom='plum', la=((-20,26),(-8,50)), ra=((28,8),(54,-10)), ll=((-9,40),(-12,80)), rl=((9,40),(10,80)), tilt=9)
    b += person(448, 292, 1.75, skin=0, hair=3, style='long', top='deep', bottom='ink', la=((-28,8),(-54,-10)), ra=((20,26),(8,50)), ll=((-9,40),(-10,80)), rl=((9,40),(12,80)), tilt=-9)
    b += heart(410, 70, 1.2, '#fff3f0', .95) + spark(160, 220, 1.1, .9) + spark(650, 200, 1, .9) + spark(520, 90, .8, .8) + spark(260, 80, .8, .8)
    return wrap(b, W, H, u, '#3a1a38', '#a04a5c', '#f0a070')

if __name__ == '__main__':
    import os; os.makedirs(OUT, exist_ok=True)
    for n,f in S.items(): open(f'{OUT}/{n}.svg','w').write(f())
    print(len(S))
