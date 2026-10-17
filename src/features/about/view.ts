import { append, element, link } from '../shared/dom';
import { heading } from '../shared/pieces';
import type { PageFactory } from '../../app/view';
import sources from '../../content/sources.json';
export const mountAbout: PageFactory = host => {
  append(host, heading('关于影作', '借一张幕，讲一次回家。', '《影作·一幕团圆》据传统故事《劈山救母》原创交互改编，由零组创作。'));
  const article = element('article', 'reading-column');
  append(article, element('h2', '', '故事与本次创作'), element('p', '', '本作取沉香救母的故事主线，另写四幕短戏、对白与互动顺序。灯下同台是一段舞台化的记忆；共同纹样是本次创作的呼应意象。'), element('p', '', '人物、配色与数字关节采用混合设计和简化示意，不声称复原某一地方流派。京剧《宝莲灯》的梗概仅用于核对人物和主线，不作为完整皮影戏本。'), element('h2', '', '这场排演，走到哪里了'), element('p', '', '目前可以保留自己的纹样与配色，阅读剧情检查点，直达展区目录。人物动作、灯影控制与展品演示正在陆续排演，声音尚未启用。'), element('p', '', '创作成员姓名、实际分工及素材许可将随正式作品核实后列出；这里不代填尚未确认的信息。'));
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
