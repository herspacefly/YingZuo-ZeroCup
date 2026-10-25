import '../../styles/site.css';
import music from '../../content/music.json';
import media from '../../content/museum-media.json';
import sources from '../../content/sources.json';
import {append,element,link} from '../shared/dom';
const host=document.getElementById('credits-content')!;
function card(title:string,id:string){const section=element('section','surface-card');section.id=id;section.appendChild(element('h2','',title));host.appendChild(section);return section;}
const sound=card('音乐与录音','music');for(const track of music.tracks)append(sound,element('h3','',track.title),element('p','',track.credit),element('p','',track.processing),link('原录音与数据集',track.sourceUrl),link('CC BY 4.0',track.licenseUrl));
const font=card('字体','font');append(font,element('p','','艺术题字采用Ma Shan Zheng；正文、剧情与导航采用常规楷体。网页内置基于LXGW WenKai Regular的字集，并保留系统楷体回退。'),link('字体项目','https://github.com/googlefonts/mashanzheng'),link('OFL字体许可','./assets/presentation/OFL.txt'),link('正文楷体来源','https://github.com/lxgw/LxgwWenKai'),link('楷体OFL许可','./assets/typography/OFL.txt'));
const tools=card('创作与工具','tools');append(tools,element('p','','零组 · 张宇翔（SpaceFly）。程序、美术方向与图形绘制使用AI辅助。皮影分件及首页莲灯画面采用AI辅助美术素材；它们不是传统皮影实物记录。'),element('p','','Three.js用于三维空间；Vite与TypeScript用于工程构建。不使用预设样式库。'));
for(const image of media.media){const section=card(image.title,image.id);append(section,element('p','',image.region+' · '+image.originalCaption),element('p','',image.credit),element('p','',image.rightsNote));if(image.sourcePage)section.appendChild(link('原资料页面',image.sourcePage));if(image.originalImage)section.appendChild(link('原始图片',image.originalImage));}
for(const source of sources.sources){const facts=card(source.title,'source-'+source.id);append(facts,link(source.publisher+' · '+source.title,source.url),element('p','',source.verificationNote));}
