import { append, element, link } from '../shared/dom';
import { heading } from '../shared/pieces';
import type { PageFactory } from '../../app/view';
import sources from '../../content/sources.json';
import music from '../../content/music.json';
export const mountAbout: PageFactory = host => {
  append(host, heading('关于影作', '借一张幕，讲一次回家。', '《影作·一幕团圆》据传统故事《劈山救母》原创交互改编，由零组创作。'));
  const article = element('article', 'reading-column');
  append(article, element('h2', '', '故事与本次创作'), element('p', '', '本作取沉香救母的故事主线，另写四幕短戏、对白与互动顺序。灯下同台是一段舞台化的记忆；共同纹样是本次创作的呼应意象。'), element('p', '', '三位人物、配色与场景是本作原创皮影风格设计稿，数字关节采用简化结构，不声称复原某一地方流派。京剧《宝莲灯》的梗概仅用于核对人物和主线，不作为完整皮影戏本。'), element('h2', '', '一出戏，也是一座展馆'), element('p', '', '可以制偶、打光、亲手演过两条路径并完成伸手与谢幕；五区八件展品可随时参观，团圆后可留下节目单、图像和本场文件。幕面下可展开空间观察，看看灯、影偶与操偶杆。'), element('p', '', '音乐与舞台音效均默认关闭，可分别开启。背景使用京剧《贵妃醉酒》选段的京胡纯器乐，谢幕使用宋若萱演唱与对应京胡的混合节选；曲目来自JaCRC v2.0的CC BY 4.0新录音，并非本剧原声或皮影地方唱腔。'), element('h2', '', '创作者与素材'), element('p', '', '零组 · 张宇翔（SpaceFly），唯一成员。作品的程序、美术方向与图形绘制使用AI辅助；人物与背景由本项目的AI美术方向图分件制作，按参考图调整比例、服饰和手型，接回可活动的数字关节；换色保留图中衣纹与明暗。设计稿、文化与素材许可仍待作者审看确认。'));
  const musicList=element('div','source-list');
  for(const track of music.tracks){const source=link('原录音与数据集',track.sourceUrl),license=link('CC BY 4.0',track.licenseUrl);source.target=license.target='_blank';source.rel=license.rel='noopener noreferrer';append(musicList,element('h3','',track.title),element('p','',track.credit),element('p','quiet-note',track.processing+'；仅在本地播放选段，不依赖外部服务。'),source,element('span','',' · '),license);}
  append(article,element('h2','','音乐来源与改动'),musicList);
  const list = element('ul', 'source-list');
  for (const source of sources.sources) {
    const li = element('li'), a = link(`${source.publisher} · ${source.title}`, source.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
    append(li, a, element('p', 'quiet-note', source.verificationMethod === 'page' ? '已核对原文，资料引用不等于媒体复用许可。' : source.verificationMethod === 'official-search-index' ? '已核对官方索引，原页访问受阻。' : '原页访问受阻，正文尚未核验。')); list.appendChild(li);
  }
  append(article, element('h2', '', '改编与文化资料'), list);
  const tools = element('details', 'dev-links'); tools.appendChild(element('summary', '', '查看排演与运行检查'));
  for (const [label, href] of [['文字排演', './story.html'], ['资产检查', './assets.html'], ['存档工作台', './project.html'], ['兼容探针', './probe.html']]) {
    const a = link(`${label}（新窗口） ↗`, href!); a.target = '_blank'; a.rel = 'noopener noreferrer'; tools.appendChild(a);
  }
  article.appendChild(tools); host.appendChild(article);
  return { update() {}, dispose() {} };
};
