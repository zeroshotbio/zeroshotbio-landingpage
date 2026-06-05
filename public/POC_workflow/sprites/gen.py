#!/usr/bin/env python3
# Procedural high-res "pixel-art" sprites for the POC modality picker.
# Hard-edged (nearest-neighbor) pixels, CPK / biologically-plausible shapes with sphere/cylinder shading.
import zlib, struct, math

N = 120  # internal grid (~7.5x the old 16px; renders crisp when upscaled with image-rendering:pixelated)
BANDS = 5  # cel-shading levels — posterized for a crafted pixel-art look (vs smooth 3D render)

def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))
def band(t, n=BANDS): return round(clamp(t)*(n-1))/(n-1)  # quantize shading into discrete steps
def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))
def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(3))

class Canvas:
    def __init__(self, n=N):
        self.n = n
        self.px = [[None]*n for _ in range(n)]  # each cell: (r,g,b)
    def put(self, x, y, color):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.px[y][x] = color

    def ball(self, cx, cy, r, base, hi=None, sh=None, light=(-0.55, -0.6, 0.58)):
        """Shaded sphere — glossy ball-and-stick look."""
        if hi is None: hi = mix(base, (255,255,255), 0.6)
        if sh is None: sh = mix(base, (0,0,0), 0.55)
        lx, ly, lz = light; ll = math.sqrt(lx*lx+ly*ly+lz*lz); lx,ly,lz = lx/ll,ly/ll,lz/ll
        for y in range(int(cy-r-1), int(cy+r+2)):
            for x in range(int(cx-r-1), int(cx+r+2)):
                dx = (x-cx)/r; dy = (y-cy)/r; d2 = dx*dx+dy*dy
                if d2 > 1.0: continue
                nz = math.sqrt(max(0.0, 1.0-d2))
                diff = clamp(dx*lx+dy*ly+nz*lz)
                amb = 0.34
                inten = band(amb + (1-amb)*diff)
                col = mix(sh, base, clamp(inten*1.22))
                if inten >= 0.999: col = mix(col, hi, 0.85)  # top band = highlight
                self.put(x, y, col)

    def capsule(self, p0, p1, r, base, hi=None, sh=None, sidelight=True):
        """Shaded cylinder/tube between two points (rounded ends)."""
        if hi is None: hi = mix(base, (255,255,255), 0.55)
        if sh is None: sh = mix(base, (0,0,0), 0.5)
        x0,y0 = p0; x1,y1 = p1
        vx,vy = x1-x0, y1-y0; L2 = vx*vx+vy*vy
        if L2 == 0: L2 = 1e-6
        # perpendicular unit (for cross-tube shading): light comes from upper-left
        px,py = -vy, vx; pl = math.sqrt(px*px+py*py) or 1; px,py = px/pl, py/pl
        ld = (px*-0.5 + py*-0.6)  # which side faces light
        for y in range(int(min(y0,y1)-r-1), int(max(y0,y1)+r+2)):
            for x in range(int(min(x0,x1)-r-1), int(max(x0,x1)+r+2)):
                t = ((x-x0)*vx+(y-y0)*vy)/L2; t = clamp(t)
                projx,projy = x0+t*vx, y0+t*vy
                dd = math.hypot(x-projx, y-projy)
                if dd > r: continue
                # cross-section param: -1..1 across tube
                s = ((x-projx)*px+(y-projy)*py)/r
                cyl = math.sqrt(max(0.0,1.0-s*s))  # 1 at center, 0 at edge
                lit = band(0.32 + 0.68*cyl*(0.55+0.45*(0.5- s*ld)))
                col = mix(sh, base, clamp(lit*1.2))
                if lit >= 0.999 and (s*ld) < 0: col = mix(col, hi, 0.7)
                self.put(x, y, col)

    def seg(self, p0, p1, color, w=1):
        x0,y0 = int(round(p0[0])),int(round(p0[1])); x1,y1=int(round(p1[0])),int(round(p1[1]))
        dx=abs(x1-x0); dy=-abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1; err=dx+dy
        while True:
            for ox in range(-(w//2), w-w//2):
                for oy in range(-(w//2), w-w//2):
                    self.put(x0+ox, y0+oy, color)
            if x0==x1 and y0==y1: break
            e2=2*err
            if e2>=dy: err+=dy; x0+=sx
            if e2<=dx: err+=dx; y0+=sy

    def outline(self, color=(8,10,18), grow=1):
        """Add a dark rim around all opaque pixels for clean separation from the panel."""
        n=self.n; src=[row[:] for row in self.px]
        for y in range(n):
            for x in range(n):
                if src[y][x] is not None: continue
                near=False
                for oy in range(-grow,grow+1):
                    for ox in range(-grow,grow+1):
                        yy,xx=y+oy,x+ox
                        if 0<=xx<n and 0<=yy<n and src[yy][xx] is not None: near=True
                if near: self.px[y][x]=color

# ---------------- Antibody (IgG Y, domain beads) ----------------
def antibody():
    c = Canvas()
    FAB   = hx('#3f7fc2'); FABhi=hx('#a7d2f4'); FABsh=hx('#163a63')
    VAR   = hx('#5fa0e0')
    CDR   = hx('#e85b48'); CDRhi=hx('#ffb09e')
    FC    = hx('#1f9d96'); FChi=hx('#74e6d6'); FCsh=hx('#0b4a47')
    KNOT  = hx('#13415f'); SS=hx('#f2c84a')
    H = (48, 50)  # hinge
    TL = (18, 15); TR = (78, 15)
    # Fc — two heavy chains as a slight V, two stacked domains each
    for dx in (-1,1):
        top=(48+dx*3,52); bot=(48+dx*9,90)
        c.capsule(top, bot, 6.2, FC, FChi, FCsh)
    # notch between CH2/CH3 domains
    c.ball(40,72,2.0, FCsh, FCsh, FCsh); c.ball(56,72,2.0, FCsh, FCsh, FCsh)
    # Fab arms (constant domain near hinge)
    for T in (TL, TR):
        c.capsule(H, T, 6.4, FAB, FABhi, FABsh)
    # variable domains (distal third) lighter, then CDR cap at the tip
    for T in (TL, TR):
        mx = (H[0]*0.42+T[0]*0.58, H[1]*0.42+T[1]*0.58)
        c.capsule(mx, T, 6.0, VAR, mix(VAR,(255,255,255),0.55), mix(VAR,(0,0,0),0.45))
    for T in (TL, TR):
        c.ball(T[0], T[1]+1, 5.2, CDR, CDRhi)
    # hinge knot + disulfides
    c.ball(48,51,5.5, KNOT, mix(KNOT,(255,255,255),0.4))
    c.seg((44,60),(52,64), SS, 2); c.seg((44,68),(52,72), SS, 2)
    c.outline()
    return c

# ---------------- siRNA / RNA A-form duplex ----------------
def rna():
    c = Canvas()
    BB   = hx('#9a45d6'); BBf=hx('#d49bf2'); BBb=hx('#4d1f78')
    bases = {'A':hx('#e0564d'),'U':hx('#e6b84e'),'G':hx('#46b25e'),'C':hx('#4385d6')}
    pair = {'A':'U','U':'A','G':'C','C':'G'}
    cx=48; A=22; period=33.0; y0,y1=8,88
    seq=['G','C','A','U','G','C','A','U','G','C','A','U','G','C','A']
    def s1(y): return cx + A*math.sin(2*math.pi*y/period)
    def s2(y): return cx - A*math.sin(2*math.pi*y/period)
    def depth(y): return math.cos(2*math.pi*y/period)  # +front -back for strand1
    # base-pair rungs (draw behind backbones)
    bi=0
    for y in range(y0+4, y1-3, 6):
        x1=s1(y); x2=s2(y); b=seq[bi%len(seq)]; bi+=1
        col=bases[b]; colc=bases[pair[b]]
        mxp=(x1+x2)/2
        # left half + right half (base / complement), thinner toward edge-on
        c.seg((x1, y), (mxp, y), mix(col,(0,0,0),0.0), 4)
        c.seg((mxp, y), (x2, y), colc, 4)
    # backbones as chained capsules, shaded by depth (front bright / back dark)
    for strand,sf in ((s1,1),(s2,-1)):
        prev=None
        for y in range(y0, y1+1, 2):
            x=strand(y); d = depth(y)*sf
            base = mix(BBb, BBf, clamp((d+1)/2))
            if prev is not None:
                c.capsule(prev,(x,y), 4.2, base, mix(base,(255,255,255),0.5), mix(base,(0,0,0),0.45))
            prev=(x,y)
    c.outline()
    return c

# ---------------- Small molecule (ball-and-stick, CPK) ----------------
def molecule():
    c = Canvas()
    C=hx('#41464e'); Chi=hx('#9aa0aa'); Csh=hx('#191c21')
    O=hx('#d8392b'); N=hx('#2f63d6'); BOND=hx('#737a85')
    cx,cy,R=38,48,16
    import math as m
    # flat-top hexagon vertices
    verts=[]
    for k in range(6):
        ang=m.radians(60*k)
        verts.append((cx+R*m.cos(ang), cy+R*m.sin(ang)))
    v0,v1,v2,v3,v4,v5 = verts
    C7=(68,42); Ox=(76,28); Nr=(80,54); Nu=(24,18); Cm=(22,74)
    bonds=[(v0,v1),(v1,v2),(v2,v3),(v3,v4),(v4,v5),(v5,v0),
           (v0,C7),(C7,Nr),(v2,Nu),(v4,Cm)]
    # draw all single bonds (cylinders)
    for a,b in bonds:
        c.capsule(a,b,2.6, BOND, mix(BOND,(255,255,255),0.5), mix(BOND,(0,0,0),0.5))
    # aromatic inner double-bond hints
    cen=(cx,cy)
    for a,b in [(v0,v1),(v2,v3),(v4,v5)]:
        ia=(a[0]*0.78+cen[0]*0.22, a[1]*0.78+cen[1]*0.22)
        ib=(b[0]*0.78+cen[0]*0.22, b[1]*0.78+cen[1]*0.22)
        c.seg(ia, ib, mix(BOND,(0,0,0),0.15), 2)
    # carbonyl double bond C7=O
    d=(Ox[0]-C7[0], Ox[1]-C7[1]); ln=m.hypot(*d); ux,uy=d[0]/ln,d[1]/ln; pxv,pyv=-uy,ux
    c.capsule(C7,Ox,2.6, BOND, mix(BOND,(255,255,255),0.5), mix(BOND,(0,0,0),0.5))
    c.seg((C7[0]+pxv*2.6,C7[1]+pyv*2.6),(Ox[0]+pxv*2.6,Ox[1]+pyv*2.6), mix(BOND,(0,0,0),0.1),2)
    # atoms (balls) — draw on top
    for v in verts: c.ball(v[0],v[1],5.2, C, Chi, Csh)
    c.ball(*C7,5.2, C, Chi, Csh)
    c.ball(*Cm,5.2, C, Chi, Csh)
    c.ball(*Ox,5.8, O)
    c.ball(*Nr,5.8, N); c.ball(*Nu,5.8, N)
    c.outline()
    return c

# ---------------- PNG (RGBA) ----------------
def write_png(path, canvas, bg=None):
    n=canvas.n
    raw=bytearray()
    for y in range(n):
        raw.append(0)
        for x in range(n):
            p=canvas.px[y][x]
            if p is None:
                if bg is None: raw+=bytes((0,0,0,0))
                else: raw+=bytes((*bg,255))
            else: raw+=bytes((p[0],p[1],p[2],255))
    def chunk(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    png=b"\x89PNG\r\n\x1a\n"
    png+=chunk(b"IHDR",struct.pack(">IIBBBBB",n,n,8,6,0,0,0))
    png+=chunk(b"IDAT",zlib.compress(bytes(raw),9))
    png+=chunk(b"IEND",b"")
    open(path,"wb").write(png)

sprites={'mab':antibody(),'rna':rna(),'smol':molecule()}
for k,c in sprites.items():
    write_png(f"/tmp/sprites/{k}.png", c)

# preview sheet on dark gradient panels, upscaled 3x nearest-neighbor
SC=3; pad=12
def panel_bg(W,H):
    grid=[[None]*W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            t=(x+y)/(W+H)
            grid[y][x]=mix(hx('#0f172a'),hx('#1e293b'),t)
    return grid
cells=[]
for k in ('mab','rna','smol'):
    c=sprites[k]; W=c.n*SC
    bgp=panel_bg(W,W)
    for y in range(c.n):
        for x in range(c.n):
            p=c.px[y][x]
            if p is None: continue
            for oy in range(SC):
                for ox in range(SC):
                    bgp[y*SC+oy][x*SC+ox]=p
    cells.append(bgp)
cw=cells[0][0].__len__(); ch=len(cells[0])
W=pad+(cw+pad)*3; H=pad*2+ch
sheet=[[hx('#0a0a0a')]*W for _ in range(H)]
for i,cell in enumerate(cells):
    ox=pad+(cw+pad)*i
    for y in range(ch):
        for x in range(cw):
            sheet[pad+y][ox+x]=cell[y][x]
raw=bytearray()
for y in range(H):
    raw.append(0)
    for x in range(W):
        r,g,b=sheet[y][x]; raw+=bytes((r,g,b))
def chunk(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",W,H,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(bytes(raw),9))+chunk(b"IEND",b"")
open("/tmp/sprites/preview.png","wb").write(png)
print("ok", {k:(c.n) for k,c in sprites.items()})
