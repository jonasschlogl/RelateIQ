import math
from blog_lib import *
def poly(d,fill,sw=4,off=6,tf='',op=1):
    return (f'<g transform="{tf}"><path d="{d}" transform="translate({off} {off})" fill="{K}" stroke="{K}" stroke-width="{sw}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="{fill}" stroke="{K}" stroke-width="{sw}" stroke-linejoin="round"/></g>')
def ell(cx,cy,rx,ry,fill,sw=4,off=5,tf=''):
    return (f'<g transform="{tf}"><ellipse cx="{cx+off}" cy="{cy+off}" rx="{rx}" ry="{ry}" fill="{K}"/><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{K}" stroke-width="{sw}"/></g>')
def circ(cx,cy,r,fill,sw=4,off=5):
    return f'<circle cx="{cx+off}" cy="{cy+off}" r="{r}" fill="{K}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{K}" stroke-width="{sw}"/>'
def cloud(x,y,s,fill=CREAM):
    sh=[('c',x-40*s,y+8*s,26*s),('c',x,y-8*s,36*s),('c',x+42*s,y+6*s,28*s),('r',x-62*s,y+8*s,130*s,26*s,13*s)]
    return union(sh,fill,3.5,5)
def flower(x,y,r,petal,center=GOLD,n=6,rot=0):
    o=''
    for i in range(n):
        a=math.radians(rot+i*360/n); px,py=x+r*.78*math.cos(a),y+r*.78*math.sin(a)
        o+=f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r*.5:.1f}" fill="{petal}" stroke="{K}" stroke-width="3.5"/>'
    o+=f'<circle cx="{x}" cy="{y}" r="{r*.42:.1f}" fill="{center}" stroke="{K}" stroke-width="3.5"/>'
    return o
def bolt(x,y,s,fill=ROSE):
    d='M4 -14 L-8 2 L-1 2 L-4 14 L8 -3 L1 -3 Z'
    return f'<path d="{d}" transform="translate({x} {y}) scale({s})" fill="{fill}" stroke="{K}" stroke-width="{2.6/s:.2f}" stroke-linejoin="round"/>'
def dotsbg(c1,c2,gap=34,r=3.5):
    o=f'<rect width="{W}" height="{H}" fill="{c1}"/>'
    for i in range(0,W//gap+2):
        for j in range(0,H//gap+2):
            o+=f'<circle cx="{i*gap+(gap/2 if j%2 else 0)}" cy="{j*gap}" r="{r}" fill="{c2}"/>'
    return o
def stripesbg(c1,c2,w=40):
    o=f'<rect width="{W}" height="{H}" fill="{c1}"/>'
    for i in range(0,W//w+1,2): o+=f'<rect x="{i*w}" width="{w}" height="{H}" fill="{c2}"/>'
    return o
def svgw(bg,body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">{bg}{body}</svg>'
