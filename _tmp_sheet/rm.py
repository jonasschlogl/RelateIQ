import re,sys
p=sys.argv[1]
s=open(p).read()
a=s.index('<div class="dm-root" id="dm-root"')
m=re.search(r'<div class="dm-tabs".*?</div>\s*</div>', s[a:], re.S)
s=s[:a].rstrip(' ')+s[a+m.end():].lstrip('\n')
s=re.sub(r'[ \t]*<link rel="stylesheet" href="css/hero-demo\.css[^>]*>\n','',s)
s=re.sub(r'[ \t]*<script defer src="js/hero-demo\.js[^>]*></script>\n','',s)
open(p,'w').write(s)
print('dm-' in s, 'hero-demo' in s)
