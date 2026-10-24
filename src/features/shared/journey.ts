import '../../styles/journey.css';
import type { AppRoute } from '../../app/router';
import type { StoreState } from '../../app/store';
import { append, element, link } from './dom';

export type ExperienceStep = 'background' | 'craft' | 'light' | 'practice' | 'story' | 'result' | 'museum';
const steps: { id: ExperienceStep; title: string; path: AppRoute['path'] }[] = [
  { id: 'background', title: '故事缘起', path: '/' }, { id: 'craft', title: '制偶', path: '/craft' },
  { id: 'light', title: '调灯', path: '/light' }, { id: 'practice', title: '练习', path: '/practice' },
  { id: 'story', title: '正式演出', path: '/story' }, { id: 'result', title: '留影成果', path: '/result' },
  { id: 'museum', title: '展馆', path: '/museum' },
];
/** Page-session presentation only. No journey state enters a project or checkpoint. */
export function mountJourney(host: HTMLElement, route: AppRoute) {
  const section = element('nav', 'experience-path'), label = element('p', 'quiet-note'), list = element('ol');
  section.setAttribute('aria-label', '推荐体验顺序');
  for (const [i, step] of steps.entries()) {
    const li = element('li'), anchor = link(`${i + 1} ${step.title}`, `#${step.path}`);
    if (route.path === step.path) { anchor.setAttribute('aria-current', 'step'); li.className = 'current'; }
    li.appendChild(anchor); list.appendChild(li);
  }
  append(section, label, list); if(route.path==='/museum')host.appendChild(section);else if(route.path==='/')host.insertBefore(section,host.firstChild?.nextSibling??null);else host.insertBefore(section,host.firstChild);
  const recommended=Array.from(host.querySelectorAll<HTMLElement>('.journey-recommended'));
  const observer=typeof window.IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('journey-visible');observer?.unobserve(entry.target);}
  },{threshold:.25}):null;
  for(const button of recommended){if(observer)observer.observe(button);else button.classList.add('journey-visible');}
  return { update(state: StoreState) {
    label.textContent = route.path==='/museum'?'展馆可以独立阅读。想亲手操演，再沿下列入口走进剧场。':state.project?.story && !['completed', 'curtain'].includes(state.project.story.nodeId)
      ? '这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。'
      : '初次来访，沿这七步走一遍。每页有明确的下一步，也可以随时自由逛展。';
  }, dispose() { observer?.disconnect();if(section.parentNode)section.parentNode.removeChild(section); } };
}
