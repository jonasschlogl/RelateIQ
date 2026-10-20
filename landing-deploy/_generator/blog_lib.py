import math
HEART='M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z'
K='#3b2218';CREAM='#fff3e2';GOLD='#f7d99a';PINK='#f2a0b4';ORG='#f8c7a3';ROSE='#e5718a';DEEP='#b03a60'
BGP='#f4b8c4';BGG='#f7d99a';BGO='#f8c7a3';BGB='#e9cdb8'
W,H=800,450
def st(d,fill,tf='',sw=4,off=6,sc=1,extra=''):
    s=sw/sc;o=off/sc
    return (f'<g transform="{tf}"><path d="{d}" transform="translate({o:.2f} {o:.2f})" fill="{K}"/>'
            f'<path d="{d}" fill="{fill}" stroke="{K}" stroke-width="{s:.2f}" stroke-linejoin="round"/>{extra}</g>')
def heart(x,y,sc,col,rot=0,inner='',sw=4,off=6):
    return st(HEART,col,f'translate({x} {y}) rotate({rot} 50 44) scale({sc})',sw,off,sc,inner)
def rrect(x,y,w,h,r,fill,sw=4,off=6,tf=''):
    return (f'<g transform="{tf}"><rect x="{x+off}" y="{y+off}" width="{w}" height="{h}" rx="{r}" fill="{K}"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{K}" stroke-width="{sw}"/></g>')
def star(x,y,sc,c=CREAM):
    return f'<path d="M0-12C1.4-4 4-1.4 12 0 4 1.4 1.4 4 0 12-1.4 4-4 1.4-12 0-4-1.4-1.4-4 0-12Z" transform="translate({x} {y}) scale({sc})" fill="{c}" stroke="{K}" stroke-width="1.6"/>'
def dots(cx,cy,gap=24,r=7): return ''.join(f'<circle cx="{cx+(i-1)*gap}" cy="{cy}" r="{r}" fill="{K}"/>' for i in range(3))
def bar(x,y,w,c=CREAM,h=12): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{c}" stroke="{K}" stroke-width="3"/>'
def bubble(x,y,w,h,fill,side='l',inner=''):
    r=h/2
    if side=='l': pts=f'{x+34},{y+h-4} {x+12},{y+h+36} {x+80},{y+h-4}'; s1,s2=x+38,x+76
    else: pts=f'{x+w-34},{y+h-4} {x+w-12},{y+h+36} {x+w-80},{y+h-4}'; s1,s2=x+w-76,x+w-38
    sh=f'<g transform="translate(6 6)" fill="{K}" stroke="{K}" stroke-width="4" stroke-linejoin="round"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/><polygon points="{pts}"/></g>'
    fg=(f'<polygon points="{pts}" fill="{fill}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{K}" stroke-width="4"/>'
        f'<line x1="{s1}" y1="{y+h}" x2="{s2}" y2="{y+h}" stroke="{fill}" stroke-width="7"/>')
    return sh+fg+inner
def union(shapes,fill,sw=4,off=6):
    def one(s,extra):
        t=s[0]
        if t=='c': return f'<circle cx="{s[1]}" cy="{s[2]}" r="{s[3]}" {extra}/>'
        if t=='r': return f'<rect x="{s[1]}" y="{s[2]}" width="{s[3]}" height="{s[4]}" rx="{s[5]}" {extra}/>'
        if t=='p': return f'<path d="{s[1]}" {extra}/>'
    sh=f'<g transform="translate({off} {off})">'+''.join(one(s,f'fill="{K}" stroke="{K}" stroke-width="{sw*2}" stroke-linejoin="round"') for s in shapes)+'</g>'
    ol=''.join(one(s,f'fill="{K}" stroke="{K}" stroke-width="{sw*2}" stroke-linejoin="round"') for s in shapes)
    fl=''.join(one(s,f'fill="{fill}"') for s in shapes)
    return sh+ol+fl
def arc(cx,cy,r,a0,a1,col,sw=16,head=True):
    A0,A1=math.radians(a0),math.radians(a1)
    x0,y0=cx+r*math.cos(A0),cy+r*math.sin(A0); x1,y1=cx+r*math.cos(A1),cy+r*math.sin(A1)
    large=1 if (a1-a0)%360>180 else 0
    d=f'M{x0:.1f} {y0:.1f} A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}'
    o=(f'<path d="{d}" transform="translate(5 5)" stroke="{K}" stroke-width="{sw+8}" fill="none" stroke-linecap="round"/>'
       f'<path d="{d}" stroke="{K}" stroke-width="{sw+8}" fill="none" stroke-linecap="round"/><path d="{d}" stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>')
    if head:
        ang=A1+math.pi/2  # tangent direction (clockwise)
        tx,ty=math.cos(ang),math.sin(ang); nx,ny=-ty,tx
        L=sw*1.9; Wd=sw*1.5
        tip=(x1+tx*L,y1+ty*L); b1=(x1+nx*Wd,y1+ny*Wd); b2=(x1-nx*Wd,y1-ny*Wd)
        pts=f'{tip[0]:.1f},{tip[1]:.1f} {b1[0]:.1f},{b1[1]:.1f} {b2[0]:.1f},{b2[1]:.1f}'
        o+=f'<polygon points="{pts}" transform="translate(5 5)" fill="{K}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/><polygon points="{pts}" fill="{col}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
    return o
def line(d,col,sw=14,dash=''):
    da=f' stroke-dasharray="{dash}"' if dash else ''
    return (f'<path d="{d}" transform="translate(4 4)" stroke="{K}" stroke-width="{sw+8}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" stroke="{K}" stroke-width="{sw+8}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"{da}/>')
def clover_bg(cx,cy,size,rot,op=.5,uid='k'):
    g=''
    for r,f in ((0,'A'),(90,'B'),(180,'A'),(270,'B')):
        g+=f'<g transform="translate(100 100) rotate({r}) translate(0 -13) scale(.8) translate(-50 -88)"><path d="{HEART}" fill="url(#{uid}{f})"/></g>'
    s=size/164
    return (f'<defs><linearGradient id="{uid}A" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d28b"/><stop offset="1" stop-color="#e0956a"/></linearGradient>'
            f'<linearGradient id="{uid}B" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5718a"/><stop offset="1" stop-color="#b03a60"/></linearGradient></defs>'
            f'<g opacity="{op}" transform="translate({cx} {cy}) rotate({rot}) scale({s}) translate(-100 -100)">{g}</g>')
def wrap(body,bg,cl):
    # cl = (cx,cy,size,rot) clover crop
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<rect width="{W}" height="{H}" fill="{bg}"/><clipPath id="cp"><rect width="{W}" height="{H}"/></clipPath><g clip-path="url(#cp)">{clover_bg(*cl)}</g>{body}</svg>')
