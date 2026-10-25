"""Offline title subset, with original upstream font and license retained for reproduction."""
from pathlib import Path
from urllib.request import urlopen
import re,json,hashlib
from fontTools import subset
root=Path(__file__).resolve().parents[1]
target=root/'public/assets/presentation';target.mkdir(parents=True,exist_ok=True)
source=root/'docs/art/presentation-font';source.mkdir(parents=True,exist_ok=True)
for name,url in [('MaShanZheng-Regular.ttf','https://raw.githubusercontent.com/googlefonts/mashanzheng/master/fonts/ttf/MaShanZheng-Regular.ttf'),('OFL.txt','https://raw.githubusercontent.com/googlefonts/mashanzheng/master/OFL.txt')]:
    path=source/name
    if not path.exists():path.write_bytes(urlopen(url,timeout=45).read())
(target/'OFL.txt').write_bytes((source/'OFL.txt').read_bytes())
text='影作一幕团圆让光影背后的名字也被看见素材致谢再练一次重放题字'
for path in (root/'src/features').rglob('*.ts'):
    value=path.read_text(encoding='utf-8')
    text+=''.join(re.findall(r"element\('h[12]'\s*,\s*'[^']*'\s*,\s*'([^']*)'",value))
    text+=''.join(re.findall(r"heading\(\s*'[^']*'\s*,\s*'([^']*)'",value))
for path in (root/'src/content/stories').glob('*.json'):
    doc=json.loads(path.read_text(encoding='utf-8'));text+=''.join(node['title'] for node in doc['nodes'])
text+=json.loads((root/'src/content/story-background.json').read_text(encoding='utf-8'))['title']
options=subset.Options();options.flavor='woff2';options.name_IDs=['*'];options.name_legacy=True
font=subset.load_font(str(source/'MaShanZheng-Regular.ttf'),options)
worker=subset.Subsetter(options=options);worker.populate(text=text);worker.subset(font)
subset.save_font(font,str(target/'title-brush.woff2'),options)
report={'source':'https://github.com/googlefonts/mashanzheng','sourceSha256':hashlib.sha256((source/'MaShanZheng-Regular.ttf').read_bytes()).hexdigest(),'glyphCharacters':''.join(sorted(set(text))),'woff2Bytes':(target/'title-brush.woff2').stat().st_size,'license':'OFL-1.1','homeArt':{'file':'lotus-theatre.png','kind':'AI-assisted-original-presentation','tool':'image_gen','purpose':'Homepage only; original story stage assets retained'}}
from PIL import Image
report['assets']=[]
for name in ['lotus-theatre.png','title-brush.woff2','OFL.txt']:
    file=target/name
    row={'path':'assets/presentation/'+name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    if name.endswith('.png'):
        with Image.open(file) as im:row.update(width=im.width,height=im.height,mode=im.mode)
    report['assets'].append(row)
(target/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(report['woff2Bytes'])
