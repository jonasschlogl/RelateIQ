import sys; sys.path.insert(0,'/root/lp')
from art2 import *
W,H=360,470

def rings(cx,cy,col='#f2c777'):
    return ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-opacity="{o}" stroke-width="1.2"/>' for r,o in ((70,.22),(112,.15),(158,.09),(208,.05)))

def practice():
    u='p'; b=glow(180,225,190,'#e5718a',.28,'pg')+rings(180,225)
    # your bubble (gold) with lines
    b+='<g transform="rotate(-3 150 170)">'+bubble(52,118,184,92,'#f6cf86','l',30)+txtlines(78,146,[118,84],'#8a5a2a',22,10)+'</g>'
    # partner bubble (rose) with typing dots
    b+='<g transform="rotate(3 210 290)">'+bubble(124,252,184,92,'#e5718a','r',30)+dots3(190,298,'#fff3f0',7,28)+'</g>'
    b+=spark(300,128,1.3,.95)+spark(46,300,.9,.8)+spark(86,392,.7,.7)+spark(318,392,.9,.8)
    return wrap(b,W,H,u,'#1c0f26','#3a1a3c','#6a2a4c')

def check():
    u='m'; b=glow(180,215,190,'#f2c777',.22,'cg')+rings(180,215)
    b+=bubble(48,108,226,104,'#fff3dc','l',32)+txtlines(76,136,[150,110],'#d2a773',26,11)
    b+='<circle cx="268" cy="110" r="36" fill="#f2c777"/><circle cx="268" cy="110" r="36" fill="none" stroke="#fff3dc" stroke-width="3" opacity=".6"/><path d="M251 111 l11 11 l21 -23" stroke="#3a1a1c" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b+='<path d="M180 248 C180 268 180 270 180 284" stroke="#f2c777" stroke-width="3" fill="none" stroke-dasharray="2 9" stroke-linecap="round"/><path d="M169 276 L180 292 L191 276" stroke="#f2c777" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    b+=bubble(88,314,184,86,'#e5718a','r',30)+heart(180,356,1.35,'#fff3f0')
    b+=spark(44,250,1,.9)+spark(322,262,1.2,.9)+spark(60,430,.7,.7)+spark(310,430,.8,.7)
    return wrap(b,W,H,u,'#1c0f26','#33183a','#5e2850')

def coach():
    u='c'; b=glow(180,225,200,'#f2c777',.30,'kg')+rings(180,225)
    b+=f'<ellipse cx="180" cy="225" rx="132" ry="132" fill="none" stroke="#ffe3a8" stroke-width="2" opacity=".45" stroke-dasharray="3 10"/>'
    for (x,y,c) in ((60,140,'#fff3dc'),(300,150,'#f6cf86'),(292,316,'#fff3dc'),(70,320,'#f6cf86')):
        b+=f'<circle cx="{x}" cy="{y}" r="15" fill="{c}"/>'+heart(x,y+1,.48,'#e5718a')
    # main heart
    b+=lin('kh','#f9d48a','#e5718a',False)
    b+='<g transform="translate(180 228)"><path d="M0 14 C-22 0 -18 -20 -7 -20 C-2 -20 0 -16 0 -13 C0 -16 2 -20 7 -20 C18 -20 22 0 0 14 Z" transform="scale(4.4)" fill="url(#kh)"/><path d="M-40 -34 C-30 -50 -12 -52 -4 -44" stroke="#fff" stroke-opacity=".5" stroke-width="7" fill="none" stroke-linecap="round" transform="translate(-8 -2)"/></g>'
    b+=spark(238,168,1.5,1)+spark(122,296,.9,.8)+spark(318,236,.8,.8)+spark(40,236,.8,.8)
    b+=bubble(128,386,104,44,'#fff3dc','r',22)+dots3(155,408,'#c98a50',5.4,25)
    return wrap(b,W,H,u,'#150b20','#2e1440','#5a2850')

if __name__=='__main__':
    for n,f in (('practice',practice),('check',check),('coach',coach)):
        open(f'/root/lp/art2/scene-{n}.svg','w').write(f())
    print('ok')
