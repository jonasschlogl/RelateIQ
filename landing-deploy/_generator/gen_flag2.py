import sys; sys.path.insert(0,'/root/lp')
from art2 import *
W,H=360,470

def practice():
    u='p'; b=''
    b += lin('pfl','#33172c','#1a0d1c')
    b += f'<path d="M0 372 Q180 360 360 372 V470 H0Z" fill="url(#pfl)"/>'
    b += window_arch(118, 34, 124, 220, u, sky=('#1a1030','#4e2250','#d98a6a'), seed=4)
    # warm light pool on floor
    b += f'<ellipse cx="180" cy="410" rx="190" ry="34" fill="#f2a870" opacity=".14"/>'
    b += rug(190, 420, 290, 44, '#6a2a50')
    b += lamp(46, 168, 214, u, glow_r=150)
    # armchair
    b += f'<rect x="236" y="262" width="104" height="120" rx="34" fill="#7a2a48"/><rect x="226" y="326" width="124" height="54" rx="20" fill="#a03a5c"/><rect x="214" y="304" width="30" height="76" rx="14" fill="#8a3050"/><rect x="332" y="304" width="30" height="76" rx="14" fill="#8a3050"/><rect x="244" y="378" width="9" height="16" rx="3" fill="#2a1424"/><rect x="332" y="378" width="9" height="16" rx="3" fill="#2a1424"/>'
    # ghost partner in the chair (AI)
    b += f'<circle cx="288" cy="296" r="86" fill="#ffd9a0" opacity=".18"/>'
    b += '<g opacity=".72">' + sitting(290, 338, .98, facing=-1, skin='#ffe9c8', hair='#ffe2a8', style='long', top='#f8c970', bottom='#ee8a9c', la=((8,26),(-10,40)), ra=((-6,28),(-22,44)), shadow=False) + '</g>'
    b += f'<path d="M232 300 q-6 -22 6 -44" stroke="#ffd9a0" stroke-width="2" fill="none" stroke-dasharray="2 6" opacity=".6"/>'
    # rehearsing person
    b += person(112, 330, 1.18, skin=2, hair=0, style='bun', top='cream', bottom='plum',
                la=((-14, 32), (2, 52)), ra=((28, 16), (50, 8)), ll=((-9, 40), (-12, 80)), rl=((9, 40), (12, 80)))
    # script card in the left hand
    b += '<rect x="96" y="286" width="26" height="34" rx="3" fill="#fff3dc" transform="rotate(-8 109 303)"/><g transform="rotate(-8 109 303)">' + txtlines(100, 293, [18, 14, 18], '#d9bf99', 7, 3.4) + '</g>'
    # bubbles
    b += bubble(20, 150, 98, 44, '#fff3dc', 'r') + txtlines(36, 163, [60, 40], '#d9bf99', 14, 7)
    b += bubble(252, 188, 84, 42, '#e5718a', 'r') + heart(294, 209, .72, '#fff3f0')
    b += spark(330, 120, 1.1, .9) + spark(40, 90, .9, .8) + spark(204, 268, .7, .7) + spark(18, 300, .7, .7)
    b += plant(330, 462, .9, seed=2)
    return wrap(b, W, H, u, '#241020', '#4a2040', '#7e3550')

def check():
    u='m'; b=''
    b += lin('mfl','#2e1424','#1a0c18')
    b += f'<path d="M0 392 Q180 382 360 392 V470 H0Z" fill="url(#mfl)"/>'
    b += curtain(262, 120, 80, 250, '#7a2a48')
    b += frame_pic(30, 190, 54, 70, '#f2c777', '#e5718a', 'mp1') + frame_pic(30, 270, 40, 52, '#e5718a', '#8a4a78', 'mp2')
    b += lamp(320, 250, 140, u, glow_r=120)
    b += sofa(70, 300, 220, '#9a3a5c', u, 84)
    b += pillow(72, 320, 40, '#f2c777', -8) + pillow(250, 322, 38, '#f8b8c0', 8)
    b += sitting(180, 354, 1.18, facing=1, skin=1, hair=1, style='long', top='gold', bottom='mauve',
                 la=((-4, 30), (18, 14)), ra=((8, 30), (20, 18)), tilt=-3)
    # phone in hands
    b += phone(168, 304, 26, 44, u, -4, '#3a2038') + '</g>'
    # floating review card
    b += f'<circle cx="180" cy="150" r="130" fill="#ffd9a0" opacity=".12"/>'
    b += '<g transform="translate(54 88) scale(.86)">'
    b += '<path d="M30 0 H262 Q292 0 292 30 V120 Q292 150 262 150 H128 L104 184 L100 150 H30 Q0 150 0 120 V30 Q0 0 30 0Z" fill="#fff3dc"/>'
    b += txtlines(26, 26, [200, 232], '#d9bf99', 22, 11)
    b += '<rect x="26" y="70" width="136" height="11" rx="5.5" fill="#e5718a"/><rect x="170" y="70" width="70" height="11" rx="5.5" fill="#d9bf99"/>'
    b += '<path d="M26 94 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e5718a" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    b += '<defs><linearGradient id="mmt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbdc9a"/><stop offset=".55" stop-color="#e9a766"/><stop offset="1" stop-color="#e5718a"/></linearGradient></defs>'
    b += '<rect x="26" y="118" width="240" height="9" rx="4.5" fill="url(#mmt)"/><circle cx="96" cy="122.5" r="10" fill="#fff" stroke="#2b1622" stroke-width="3"/>'
    b += '</g>'
    b += '<g transform="translate(306 96)"><circle r="26" fill="#f2c777"/><circle r="26" fill="none" stroke="#fff3d6" stroke-width="3" opacity=".6"/><path d="M-11 1 L-3 9 L12 -8" stroke="#3b1f10" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
    b += spark(24, 112, 1, .9) + spark(330, 214, .8, .8) + spark(60, 40, .7, .8)
    b += plant(38, 440, .9, seed=5)
    return wrap(b, W, H, u, '#2b1622', '#7a3042', '#d98a5a')

def coach():
    u='c'; b=''
    b += window_arch(96, 28, 168, 260, u, sky=('#120a20','#2f1a44','#7a3560'), seed=21, city=True)
    b += lin('cfl','#2a1430','#150a1a') + f'<path d="M0 372 Q180 360 360 372 V470 H0Z" fill="url(#cfl)"/>'
    b += rug(180, 430, 330, 50, '#5a2a56')
    b += sofa(150, 318, 200, '#6a3070', u, 80)
    b += pillow(158, 338, 36, '#e5718a', -8)
    # blanket over the person
    b += sitting(268, 364, 1.12, facing=-1, skin=3, hair=5, style='curly', top='#f2c777', bottom='#b03a60',
                 la=((-4, 28), (-16, 36)), ra=((4, 30), (-12, 40)), tilt=4)
    b += cup(238, 360, .9)
    # the coach: warm glowing heart that floats and listens
    b += f'<circle cx="96" cy="300" r="120" fill="url(#cglow)"/><defs><radialGradient id="cglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".65"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient><linearGradient id="chg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a8"/><stop offset=".55" stop-color="#f2a870"/><stop offset="1" stop-color="#e5718a"/></linearGradient></defs>'
    b += f'<ellipse cx="96" cy="412" rx="46" ry="8" fill="#000" opacity=".25"/>'
    b += f'<path d="M96 350 C32 306 40 236 84 236 C98 236 96 252 96 258 C96 252 94 236 108 236 C152 236 160 306 96 350Z" fill="url(#chg)"/>'
    b += f'<path d="M64 262 C70 250 82 248 86 256" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none" stroke-linecap="round"/>'
    b += f'<circle cx="96" cy="288" r="78" fill="none" stroke="#ffe3a8" stroke-width="2" opacity=".35" stroke-dasharray="3 9"/>'
    # memory pills + chat
    b += '<g><rect x="136" y="214" width="84" height="26" rx="13" fill="#fff3dc"/><rect x="148" y="224" width="40" height="7" rx="3.5" fill="#d2a773"/><circle cx="204" cy="227" r="5" fill="#e5718a"/></g>'
    b += '<g opacity=".9"><rect x="14" y="196" width="74" height="24" rx="12" fill="#fff3dc"/><rect x="26" y="205" width="36" height="6" rx="3" fill="#e5718a"/></g>'
    b += bubble(206, 262, 52, 32, '#fff3dc', 'r') + dots3(222, 278)
    b += '<rect x="26" y="410" width="0" height="0"/>'
    b += '<g><rect x="22" y="112" width="92" height="38" rx="19" fill="#fff3dc"/><text x="68" y="138" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="19" fill="#6a3a2a" text-anchor="middle">2:07 AM</text></g>'
    b += spark(150, 100, 1, .9) + spark(330, 330, .8, .8) + spark(60, 380, .7, .7)
    return wrap(b, W, H, u, '#120a1c', '#2a1440', '#5a2850')

if __name__ == '__main__':
    for n, f in (('practice', practice), ('check', check), ('coach', coach)):
        open(f'/root/lp/art2/scene-{n}.svg', 'w').write(f())
    print('ok')
