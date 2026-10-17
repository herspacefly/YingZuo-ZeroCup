import { append, element, link } from '../shared/dom';
import { heading, pendingNote } from '../shared/pieces';
import { museumOutline, museumSections } from '../../content/museum-outline';
import type { PageFactory } from '../../app/view';

export const mountMuseum: PageFactory = (host, ctx) => {
  const selected = museumOutline.find(item => item.id === ctx.route.exhibitId);
  append(host, heading('同台成馆 / 五区八件', selected?.title ?? '把刚才的光影，翻到背面看。', selected?.question ?? '不必演完，也不必集齐。沿着你感兴趣的一件，走进皮影的幕后。'));
  if (selected) {
    const detail = element('section', 'exhibit-detail');
    append(detail, element('p', 'exhibit-code', `${selected.section} / ${selected.id}`), pendingNote('这件展品正在布展。图文、来源对照与操作演示将在这里展开；当前仅开放目录，不记作已看完展品。'), link('返回五个展区 ←', '#/museum', 'button secondary'), link('回到这一场 →', '#/story'));
    host.appendChild(detail);
  }
  const sections = element('div', 'museum-sections');
  for (const [index, label] of museumSections.entries()) {
    const section = element('section', 'museum-section'), title = element('h2', '', label), list = element('div', 'exhibit-list');
    append(section, element('span', 'section-number', `0${index + 1}`), title);
    for (const exhibit of museumOutline.filter(item => item.section === label)) {
      const a = link('', `#/museum/${exhibit.id}`, 'exhibit-link'); if (selected?.id === exhibit.id) a.setAttribute('aria-current', 'page');
      append(a, element('span', 'exhibit-id', exhibit.id), element('span', 'exhibit-title', exhibit.title), element('span', 'exhibit-arrow', '↗')); list.appendChild(a);
    }
    section.appendChild(list); sections.appendChild(section);
  }
  host.appendChild(sections);
  return { update() {}, dispose() {} };
};
