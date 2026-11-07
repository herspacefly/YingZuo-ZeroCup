import exhibits from './exhibits.json';
import facts from './facts.json';
import sources from './sources.json';
import mediaDocument from './museum-media.json';
import { museumExhibits, museumFacts, museumSections } from './museum';
import { validateMuseumContent } from './museum-contract';
import { parseMuseumMedia } from './museum-media';

// Build-time only: the readable page has no app, storage, audio or renderer entry.
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const labels = { culture: '工艺与剧目资料', model: '数字示意', original: '本作原创' };

export function renderMuseumPage(): string {
  const errors = validateMuseumContent(exhibits, facts, sources);
  if (errors.length) throw new Error(errors.join('\n'));
  const media = parseMuseumMedia(mediaDocument);
  const sourceLink = (id: string) => {
    const source = sources.sources.find(row => row.id === id);
    if (!source) throw new Error(`Unknown museum source: ${id}`);
    return `<a href="${escape(source.url)}">${escape(source.publisher)} · ${escape(source.title)}</a>`;
  };
  const catalogue = `<nav class="museum-reader-toc" aria-label="知识速览目录"><h2>循着五个入口，读一出戏</h2><ol>${museumSections.map((section, index) =>
    `<li><a class="museum-reader-zone-link" href="#zone-${index}">${escape(section)}</a><ul>${museumExhibits.filter(row => row.section === section).map(exhibit =>
      `<li><a href="#${exhibit.id}"><span>${exhibit.id}</span> ${escape(exhibit.title)}</a></li>`).join('')}</ul></li>`).join('')}</ol></nav>`;
  return catalogue + museumSections.map((section, index) => `<section class="museum-reader-zone" aria-labelledby="zone-${index}"><h2 id="zone-${index}" tabindex="-1"><span>0${index + 1}</span> ${escape(section)}</h2>${museumExhibits.filter(row => row.section === section).map(exhibit => {
    const reading = media.exhibits.find(row => row.exhibitId === exhibit.id)!;
    const candidates = reading.mediaIds.map(id => media.media.find(row => row.id === id)!);
    const cover = candidates.find(row => row.kind === 'external') ?? candidates[0]!;
    const knowledge = exhibit.factIds.map(id => {
      const fact = museumFacts.find(row => row.id === id)!;
      return `<li><span class="museum-reader-kind ${fact.kind}">${labels[fact.kind]}</span><p>${escape(fact.text)}</p>${fact.sourceIds.length ? `<p class="museum-reader-fact-sources">${fact.sourceIds.map(sourceLink).join('；')}</p>` : ''}</li>`;
    }).join('');
    const contextNote = exhibit.id === 'E06' ? '<p>这件影人用于观察造型，不作为《劈山救母》的演出证明。</p>' : '';
    return `<article class="museum-reader-exhibit" id="${exhibit.id}" aria-labelledby="title-${exhibit.id}"><header><p class="eyebrow">${exhibit.id} / ${escape(exhibit.question)}</p><h3 id="title-${exhibit.id}">${escape(exhibit.title)}</h3><p class="section-lead">${escape(exhibit.summary)}</p></header><div class="museum-reader-layout"><figure><img src=".${escape(cover.localPath)}" width="${cover.width}" height="${cover.height}" alt="${escape(cover.alt)}" loading="lazy" decoding="async"><figcaption><strong>${escape(cover.title)}</strong><p>${escape(cover.description)}</p>${contextNote}<p>${escape(cover.credit)}</p>${cover.sourcePage ? `<a class="text-link" href="${escape(cover.sourcePage)}">图片原资料页面 ↗</a>` : ''}<p class="quiet-note">${escape(cover.rightsNote)}</p></figcaption></figure><div class="museum-reader-copy"><ul class="museum-reader-facts">${knowledge}</ul><details class="museum-reader-sources"><summary>继续阅读：本展签的资料来源</summary><ul>${exhibit.sourceIds.map(id => `<li>${sourceLink(id)}</li>`).join('')}</ul></details><a class="button secondary" href="./index.html#/museum/${exhibit.id}">进入互动展台 · ${exhibit.id} →</a><a class="text-link" href="#contents">返回目录 ↑</a></div></div></article>`;
  }).join('')}</section>`).join('');
}
