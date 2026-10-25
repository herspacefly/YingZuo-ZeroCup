"""Reproducible web-only regular Kai subset; original font stays in ignored cache."""
from pathlib import Path
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont
import hashlib, json

root = Path(__file__).resolve().parents[1]
revision = '4a762d7594c823a1417b7d6b1de39fa5bfc8afd4'
upstream = 'https://raw.githubusercontent.com/lxgw/LxgwWenKai/' + revision + '/'
cache = root / '.preflight/typography'
cache.mkdir(parents=True, exist_ok=True)
target = root / 'public/assets/typography'
target.mkdir(parents=True, exist_ok=True)
for name, remote in [('regular.ttf', 'fonts/TTF/LXGWWenKai-Regular.ttf'), ('OFL.txt', 'OFL.txt')]:
    path = cache / name
    if not path.exists():
        path.write_bytes(urlopen(upstream + remote, timeout=60).read())

characters = set(chr(i) for i in range(32, 127)) | set('　\n，。！？：；、（）《》“”‘’—…·↗→←↑↓')
for path in (root / 'src').rglob('*'):
    if path.suffix in ['.ts', '.json', '.html']:
        characters.update(c for c in path.read_text(encoding='utf-8') if ord(c) >= 128)
for path in root.glob('*.html'):
    characters.update(path.read_text(encoding='utf-8'))
text = ''.join(sorted(characters))
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.recalc_timestamp = False
font = subset.load_font(str(cache / 'regular.ttf'), options)
worker = subset.Subsetter(options=options)
worker.populate(text=text)
worker.subset(font)
# Keep copyright and OFL metadata, but give the derivative its own family name.
names = {1:'Yingzuo Kai',2:'Regular',3:'YingzuoKai-Regular-Web',4:'Yingzuo Kai Regular',6:'YingzuoKai-Regular',16:'Yingzuo Kai',17:'Regular',21:'Yingzuo Kai',22:'Regular'}
for record in font['name'].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
for flavor in ['woff2', 'woff']:
    font.flavor = flavor
    font.save(target / ('regular-kai.' + flavor), reorderTables=True)
(target / 'OFL.txt').write_bytes((cache / 'OFL.txt').read_bytes())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
coverage = TTFont(target / 'regular-kai.woff2').getBestCmap()
missing = ''.join(c for c in text if ord(c) not in coverage and not c.isspace())
manifest = {'source':'https://github.com/lxgw/LxgwWenKai','revision':revision,'originalURL':upstream+'fonts/TTF/LXGWWenKai-Regular.ttf','sourceSha256':digest(cache/'regular.ttf'),'license':'OFL-1.1','family':'Yingzuo Kai','derivative':'Web subset of LXGW WenKai Regular, renamed; copyright/OFL retained.','characters':text,'missingCharacters':missing,'assets':[]}
for name in ['regular-kai.woff2','regular-kai.woff','OFL.txt']:
    path = target / name
    manifest['assets'].append({'path':'assets/typography/'+name,'bytes':path.stat().st_size,'sha256':digest(path)})
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'characters':len(characters),'missing':missing,'files':manifest['assets']},ensure_ascii=False))
