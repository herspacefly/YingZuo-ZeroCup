import document from '../../content/museum-media.json';
import { parseMuseumMedia } from '../../content/museum-media';
import type { MuseumMedia } from '../../content/museum-media';
import { append, element, link, scope } from '../shared/dom';

export const museumMedia = parseMuseumMedia(document);
export function museumCover(exhibitId: string): MuseumMedia | undefined {
  const ids = museumMedia.exhibits.find(row => row.exhibitId === exhibitId)?.mediaIds ?? [];
  return museumMedia.media.find(row => ids.includes(row.id) && row.kind === 'external') ?? museumMedia.media.find(row => row.id === ids[0]);
}
function externalLink(label: string, url: string) {
  const anchor = link(label, url); anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; return anchor;
}
function attribution(media: MuseumMedia) {
  const box = element('div', 'museum-photo-attribution');
  append(box, element('p', 'museum-photo-region', media.region), element('p', '', `原图注：${media.originalCaption}`), element('p', '', media.credit));
  if (media.sourcePage && media.originalImage) append(box, externalLink('查看机构原页面 ↗', media.sourcePage), externalLink('查看原始图片 ↗', media.originalImage));
  append(box, element('p', 'quiet-note', media.rightsNote));
  return box;
}
function imageView(media: MuseumMedia, eager = false) {
  const life = scope(), box = element('div', 'museum-photo-surface'), image = element('img'), status = element('p', 'museum-photo-error'), retry = element('button', 'button secondary', '重试载入图片');
  image.alt = media.alt; image.width = media.width; image.height = media.height; image.loading = eager ? 'eager' : 'lazy'; image.decoding = 'async';
  status.hidden = true; status.setAttribute('role', 'status'); retry.type = 'button'; retry.hidden = true;
  let attempts = 0;
  life.on(image, 'error', () => { image.hidden = true; status.hidden = false; status.textContent = '这幅图片暂时未能载入。可以重试，图注与原页面仍可阅读。'; retry.hidden = false; });
  life.on(image, 'load', () => { image.hidden = false; status.hidden = true; retry.hidden = true; });
  life.on(retry, 'click', () => { image.hidden = false; status.hidden = false; status.textContent = '正在重新载入图片…'; retry.hidden = true; attempts += 1; image.src = `${media.localPath}?retry=${attempts}`; });
  image.src = media.localPath; append(box, image, status, retry);
  return { box, image, dispose: () => { life.dispose(); image.removeAttribute('src'); } };
}

export function mountMuseumGallery(host: HTMLElement, exhibitId: string) {
  const reading = museumMedia.exhibits.find(row => row.exhibitId === exhibitId), life = scope();
  if (!reading) return { dispose() { life.dispose(); } };
  const section = element('section', 'museum-gallery'); section.id = 'museum-gallery';
  section.setAttribute('aria-label', '实物图册与延伸阅读');
  const top = element('div', 'museum-gallery-heading');
  append(top, element('span', 'eyebrow', '看见材料 / 看见手艺'), element('h2', '', '沿着照片，走近一点。'), element('p', 'museum-gallery-lead', reading.lead));
  const observation = element('aside', 'museum-observation'); append(observation, element('strong', '', '带着这个问题看'), element('p', '', reading.observation));
  const prose = element('div', 'museum-gallery-reading');
  for (const paragraph of reading.paragraphs) {
    const card = element('section', 'museum-gallery-paragraph'); append(card, element('h3', '', paragraph.title), element('p', '', paragraph.text));
    for (const id of paragraph.sourceIds) { const source = museumMedia.sources.find(row => row.id === id)!; card.appendChild(externalLink(`资料 · ${source.title}`, source.url)); }
    prose.appendChild(card);
  }
  const grid = element('div', 'museum-photo-grid'), originals = element('div', 'museum-photo-grid museum-original-grid'), images: ReturnType<typeof imageView>[] = [];
  let closeModal: (() => void) | null = null, disposed = false;
  function open(media: MuseumMedia, opener: HTMLElement) {
    closeModal?.();
    const modalLife = scope(), overlay = element('div', 'museum-lightbox'), panel = element('section', 'museum-lightbox-panel'), close = element('button', 'button secondary museum-lightbox-close', '关闭大图 ×'), title = element('h2', '', media.title);
    title.id = 'museum-lightbox-title'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', title.id); panel.tabIndex = -1;
    close.type = 'button'; const large = imageView(media, true);
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    const closeNow = () => {
      if (!overlay.parentNode) return;
      modalLife.dispose(); large.dispose(); overlay.parentNode.removeChild(overlay); window.document.body.style.overflow = previousOverflow; closeModal = null;
      if (!disposed && window.document.documentElement.contains(opener)) opener.focus();
    };
    closeModal = closeNow;
    modalLife.on(close, 'click', closeNow);
    modalLife.on(overlay, 'click', event => { if (event.target === overlay) closeNow(); });
    // A real modal: keep keyboard users inside it and restore the exact opener on close.
    modalLife.on(window.document, 'keydown', event => {
      const key = event as KeyboardEvent;
      if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); closeNow(); return; }
      if (key.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')].filter(node => {
        let current: HTMLElement | null = node;
        while (current && current !== panel) { if (current.hidden) return false; current = current.parentElement; }
        return true;
      });
      const first = focusable[0], last = focusable[focusable.length - 1], active = window.document.activeElement;
      if (!first || !last) { key.preventDefault(); panel.focus(); }
      else if (key.shiftKey && (active === first || !panel.contains(active))) { key.preventDefault(); last.focus(); }
      else if (!key.shiftKey && (active === last || !panel.contains(active))) { key.preventDefault(); first.focus(); }
    });
    modalLife.on(window.document, 'focusin', event => { if (event.target instanceof Node && !panel.contains(event.target)) close.focus(); });
    const toolbar = element('div', 'museum-lightbox-toolbar'); append(toolbar, title, close);
    append(panel, toolbar, large.box, element('p', 'museum-photo-description', media.description), attribution(media)); overlay.appendChild(panel); window.document.body.appendChild(overlay); close.focus();
  }
  for (const [index,id] of [...reading.mediaIds].sort((a,b)=>Number(museumMedia.media.find(row=>row.id===a)!.kind==='original')-Number(museumMedia.media.find(row=>row.id===b)!.kind==='original')).entries()) {
    const media = museumMedia.media.find(row => row.id === id)!, card = element('figure', 'museum-photo-card'), preview = imageView(media,index===0), enlarge = element('button', 'button secondary museum-photo-enlarge', `放大查看 · ${media.title}`), caption = element('figcaption');
    card.setAttribute('data-media-kind',media.kind);
    images.push(preview); enlarge.type = 'button'; enlarge.setAttribute('aria-haspopup', 'dialog'); life.on(enlarge, 'click', () => open(media, enlarge));
    // The whole photo is also a pointer target, with a separate discoverable keyboard button.
    preview.image.style.cursor = 'zoom-in'; life.on(preview.image, 'click', () => open(media, enlarge));
    append(caption, element('span', 'museum-photo-kind', media.kind === 'external' ? '公开资料照片' : '本作数字设计'), element('h3', '', media.title), element('p', 'museum-photo-description', media.description), attribution(media));
    append(card, preview.box, enlarge, caption); (media.kind==='external'?grid:originals).appendChild(card);
  }
  append(section, top, grid, observation, prose);
  if(originals.childElementCount)append(section,element('h3','museum-original-heading','延伸 · 本作数字设计'),originals);
  host.appendChild(section);
  return { dispose() { if (disposed) return; disposed = true; closeModal?.(); life.dispose(); for (const image of images) image.dispose(); } };
}

