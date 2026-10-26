# Blog illustrations for the 5 posts added 2026-10-26. Same frame/style as the earlier posts (1200x630, flat pastel, cocoa outline).
import math, os, sys
K='#3b2218'; CREAM='#fff3e2'; PAPER='#fffaf2'; GOLD='#f7d99a'; PINK='#f4b8c4'; PEACH='#f8c7a3'; ROSE='#e5718a'; GREEN='#bfe3b4'; DGREEN='#7fbf86'; BROWN='#8a4a30'
HEART='M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z'
def frame(bg, body, shw=260, sy=552, sx=600):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-hidden="true"><rect width="1200" height="630" fill="{bg}"/>'
    '<circle cx="150" cy="120" r="210" fill="#fff" fill-opacity=".22"/><circle cx="150" cy="120" r="140" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>'
    f'<circle cx="1090" cy="86" r="42" fill="{K}" fill-opacity=".10"/><circle cx="1120" cy="610" r="230" fill="#fff" fill-opacity=".2"/>'
    f'<ellipse cx="{sx}" cy="{sy}" rx="{shw}" ry="20" fill="{K}" fill-opacity=".14"/>{body}</svg>')
def sp(x,y,r=20): return f'<path d="M{x} {y-r} L{x+r*.28} {y-r*.28} L{x+r} {y} L{x+r*.28} {y+r*.28} L{x} {y+r} L{x-r*.28} {y+r*.28} L{x-r} {y} L{x-r*.28} {y-r*.28} Z" fill="{CREAM}" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"/>'
def heart(x,y,s,fill=PINK,rot=0,sw=4): return f'<g transform="translate({x} {y}) rotate({rot}) scale({s}) translate(-50 -48)"><path d="{HEART}" fill="{fill}" stroke="{K}" stroke-width="{sw/s:.2f}" stroke-linejoin="round"/></g>'
def rect(x,y,w,h,r,fill,sw=4,tf=''): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{K}" stroke-width="{sw}"{f" transform=\"{tf}\"" if tf else ""}/>'
def circ(x,y,r,fill,sw=4): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{K}" stroke-width="{sw}"/>'
def path(d,fill='none',sw=4,tf=''): return f'<path d="{d}" fill="{fill}" stroke="{K}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{f" transform=\"{tf}\"" if tf else ""}/>'
def q(x,y,s=1,col=K): return f'<g transform="translate({x} {y}) scale({s})"><path d="M-20 -22 C-20 -56 26 -56 26 -24 C26 -6 2 -4 2 18" fill="none" stroke="{col}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="2" cy="42" r="6.5" fill="{col}"/></g>'
def steam(x,y): return path(f'M{x} {y} q-14 -22 0 -44 q14 -22 0 -44',sw=4)+path(f'M{x+34} {y} q-14 -22 0 -44 q14 -22 0 -44',sw=4)
def face(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><path d="M-22 -6 q9 -12 18 0 M4 -6 q9 -12 18 0" fill="none" stroke="{K}" stroke-width="5" stroke-linecap="round"/><path d="M-12 12 q12 14 24 0 Z" fill="{K}"/></g>'
S={}
def sc(n):
    def d(f): S[n]=f; return f
    return d
# ---------- A: date night questions (peach / gold / pink)
@sc('date-night-questions-for-couples-1')
def _():
    b=rect(540,330,120,190,14,CREAM)+path('M600 252 C566 292 574 332 600 334 C626 332 634 292 600 252Z',GOLD)+path('M600 290 C588 308 592 322 600 322 C608 322 612 308 600 290Z',PEACH,3)+path('M600 334 V346',sw=4)
    for x,col in ((300,PINK),(820,GOLD)):
        b+=path(f'M{x} 380 H{x+150} V450 C{x+150} 505 {x+112} 525 {x+75} 525 C{x+38} 525 {x} 505 {x} 450 Z',PAPER)+path(f'M{x+150} 400 C{x+205} 395 {x+205} 478 {x+142} 474',sw=4)+heart(x+75,452,.85,col,0,3)
    b+=steam(340,360)+steam(860,360)+sp(160,160)+sp(1050,300)+sp(610,170,14)
    return frame(PEACH,b,380)
@sc('date-night-questions-for-couples-2')
def _():
    b=''
    for tf,fill in (('rotate(-16 430 330)',PINK),('rotate(14 770 330)',PEACH),('rotate(0 600 320)',PAPER)):
        pass
    b+=rect(330,170,210,300,18,PINK,4,'rotate(-14 435 320)')+rect(660,170,210,300,18,PEACH,4,'rotate(14 765 320)')+rect(495,140,210,310,18,PAPER)+q(600,278,1.25)+f'<g transform="rotate(-14 435 320)">{q(435,320,.8,CREAM)}</g>'
    b+=f'<g transform="rotate(14 765 320)">{q(765,320,.8,CREAM)}</g>'+heart(860,150,.6,ROSE,10,3)+sp(190,190)+sp(1020,440,16)
    return frame(GOLD,b,330,520)
@sc('date-night-questions-for-couples-3')
def _():
    b=rect(520,150,170,310,30,PAPER)+rect(536,176,138,236,12,PEACH,3)+circ(605,436,12,CREAM,3)+heart(605,290,1.0,PINK)
    b+=f'<circle cx="605" cy="305" r="190" fill="none" stroke="{ROSE}" stroke-width="16"/><path d="M470 170 L740 440" stroke="{ROSE}" stroke-width="16" stroke-linecap="round"/>'
    b+=sp(220,190)+sp(980,200,16)+sp(960,470)
    return frame(PINK,b,300,560)
# ---------- B: say I love you without words
@sc('how-to-say-i-love-you-without-words-1')
def _():
    b=f'<g transform="translate(600 310) scale(1.7) translate(0 -20)">'+path('M-70 -10 H70 V40 C70 90 40 115 0 115 C-40 115 -70 90 -70 40 Z',PAPER)+f'<ellipse cx="0" cy="-10" rx="70" ry="16" fill="{PEACH}" stroke="{K}" stroke-width="3"/>'+path('M70 10 C115 5 115 65 62 62')+path('M-90 125 H90')+heart(0,52,.5,PINK,0,2.4)+'</g>'
    b+=heart(520,130,.7,ROSE,-8,3)+heart(690,110,.5,PINK,10,3)+sp(210,170)+sp(1000,300)+sp(980,470,14)
    return frame(PEACH,b,330,578)
@sc('how-to-say-i-love-you-without-words-2')
def _():
    b=rect(300,160,300,300,12,GOLD,4,'rotate(-5 450 310)')+rect(380,90,140,44,6,PEACH,3,'rotate(-5 450 112)')+heart(450,310,2.0,ROSE,-5,4)
    b+=rect(680,230,240,240,12,PAPER,4,'rotate(6 800 350)')+rect(740,200,120,38,6,PINK,3,'rotate(6 800 219)')+path('M730 300 H870 M730 340 H850 M730 380 H820',sw=6,tf='rotate(6 800 350)')
    b+=sp(180,420)+sp(1030,150)+sp(620,510,14)
    return frame(PINK,b,420,556)
@sc('how-to-say-i-love-you-without-words-3')
def _():
    b=rect(420,330,360,210,18,PEACH)+rect(400,270,400,72,16,PINK)+rect(570,270,60,270,0,GOLD,4)+rect(570,270,60,72,0,GOLD,4)
    b+=path('M600 270 C540 180 450 210 500 262 C530 286 585 272 600 270Z',CREAM)+path('M600 270 C660 180 750 210 700 262 C670 286 615 272 600 270Z',CREAM)+circ(600,270,22,ROSE)
    b+=heart(850,200,.6,ROSE,12,3)+sp(190,200)+sp(1010,430)+sp(280,470,14)
    return frame(GOLD,b,360,552)
# ---------- C: green flags
@sc('green-flags-in-a-relationship-1')
def _():
    b=path('M450 540 V120',sw=9)+circ(450,112,14,GOLD)+path('M462 140 C560 100 640 190 740 150 L740 330 C640 370 560 280 462 320 Z',GREEN)+heart(600,240,.9,CREAM,0,3.5)
    b+=path('M300 540 q150 -26 300 0',sw=4)+heart(860,260,.6,ROSE,10,3)+heart(900,400,.45,PINK,-8,3)+sp(200,190)+sp(1000,170,16)
    return frame(PINK,b,330,552,450)
@sc('green-flags-in-a-relationship-2')
def _():
    b=path('M600 400 C600 320 600 270 600 210',sw=6)+path('M600 330 C520 330 470 290 480 220 C560 220 600 270 600 330Z',GREEN)+path('M600 290 C680 290 730 250 720 180 C640 180 600 230 600 290Z',DGREEN)+path('M600 215 C560 180 570 130 600 110 C630 130 640 180 600 215Z',GREEN)
    b+=path('M470 400 H730 L700 540 H500 Z',PEACH)+rect(455,380,290,40,10,PINK)+heart(600,470,.6,CREAM,0,3)+sp(250,190)+sp(960,250)+heart(880,440,.5,ROSE,8,3)
    return frame(GOLD,b,300,552)
@sc('green-flags-in-a-relationship-3')
def _():
    b=rect(300,150,330,190,70,CREAM)+path('M360 336 L330 410 L440 338',CREAM)+heart(465,245,1.2,PINK)
    b+=rect(560,270,330,190,70,PINK)+path('M830 456 L870 520 L750 458',PINK)+face(725,365,1.3)
    b+=sp(220,420)+sp(1000,170,18)+sp(660,130,14)
    return frame(PEACH,b,360,568)
# ---------- D: rebuild trust
@sc('how-to-rebuild-trust-after-a-fight-1')
def _():
    b=rect(100,390,330,150,0,PEACH)+rect(770,390,330,150,0,PEACH)+path('M400 400 Q600 160 800 400',sw=40)+path('M400 400 Q600 160 800 400',sw=24).replace(f'stroke="{K}"',f'stroke="{CREAM}"')+heart(600,262,.8,ROSE,0,3.5)
    b+=path('M450 500 q40 -20 80 0 t80 0 t80 0 t80 0',sw=4)+path('M470 530 q40 -20 80 0 t80 0 t80 0',sw=4)
    b+=f'<path d="M430 540 q170 -40 340 0" fill="none" stroke="{K}" stroke-width="4"/>'+sp(220,200)+sp(1000,220)+sp(600,110,14)
    return frame(PINK,b,420,572)
@sc('how-to-rebuild-trust-after-a-fight-2')
def _():
    b=rect(330,250,230,230,24,PINK)+circ(560,365,48,PINK)+rect(520,250,230,230,24,PEACH)+circ(520,365,0,PEACH)
    # right piece socket
    b=rect(600,250,230,230,24,PEACH)+rect(350,250,230,230,24,PINK)+circ(580,365,46,PINK)+heart(465,365,.8,CREAM,0,3)+path('M650 330 q20 -12 40 0 M710 330 q20 -12 40 0',sw=4)+path('M672 395 q20 24 40 0 Z',K)
    b+=sp(220,200)+sp(1010,170)+sp(940,470,14)
    return frame(GOLD,b,380,552)
@sc('how-to-rebuild-trust-after-a-fight-3')
def _():
    b=''
    for x in (360,510,660): b+=rect(x,440,140,76,10,PEACH if x!=510 else PINK)
    for x in (435,585): b+=rect(x,364,140,76,10,PINK if x==435 else GOLD)
    b+=rect(510,288,140,76,10,PEACH)+heart(580,210,.9,ROSE,0,3.5)+path('M360 440 V516 M500 440 V516 M650 440 V516',sw=0)
    b+=sp(220,180)+sp(1010,320)+sp(930,150,16)
    return frame(PINK,b,340,538)
# ---------- E: deep questions
@sc('deep-questions-to-ask-your-partner-1')
def _():
    b=path('M640 110 C500 120 440 230 480 330 C520 430 650 460 740 400 C640 410 560 350 560 260 C560 200 590 140 640 110Z',CREAM)
    b+=rect(700,180,230,120,40,PINK)+path('M760 296 L740 350 L810 298',PINK)+q(815,236,.45)
    b+=sp(260,160,24)+sp(190,330)+sp(1000,430,18)+sp(330,470,14)+sp(900,100,16)
    return frame(GOLD,b,300,558)
@sc('deep-questions-to-ask-your-partner-2')
def _():
    b=rect(300,190,290,290,12,PAPER,4,'rotate(-4 445 335)')+rect(600,190,290,290,12,PAPER,4,'rotate(4 745 335)')+path('M600 200 V480',sw=4)
    b+=path('M340 250 H550 M340 295 H530 M340 340 H550 M340 385 H500',sw=6,tf='rotate(-4 445 335)').replace(f'stroke="{K}"','stroke="#8a4a30" stroke-opacity=".55"')
    b+=heart(745,300,1.3,PINK,4)+q(745,420,.4,CREAM)
    b+=path('M850 150 L960 330 L930 345 L820 165 Z',GOLD)+path('M960 330 L930 345 L920 380 L965 350Z',PEACH,3)
    b+=sp(220,180)+sp(1040,470)
    return frame(PINK,b,420,560)
@sc('deep-questions-to-ask-your-partner-3')
def _():
    b=path('M520 300 V240 a90 90 0 0 1 180 0 V300',sw=22)+path('M520 300 V240 a90 90 0 0 1 180 0 V300',sw=12).replace(f'stroke="{K}"',f'stroke="{CREAM}"')
    b+=rect(470,290,280,220,28,GOLD)+circ(610,380,28,K,0)+path('M610 390 V450',sw=14)
    b+=path('M820 150 a46 46 0 1 1 0.1 0',sw=0)
    b+=circ(900,160,42,ROSE)+circ(900,160,16,PEACH,3)+rect(886,200,28,150,8,ROSE)+rect(914,300,44,20,6,ROSE)+rect(914,334,36,20,6,ROSE)
    b+=sp(240,190)+sp(1040,420)+sp(290,440,14)
    return frame(PEACH,b,330,560)
os.makedirs('out',exist_ok=True)
for k,f in S.items(): open(f'out/{k}.svg','w').write(f())
print(len(S))
