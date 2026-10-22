// Independent, serializable exhibition media contract. It never enters ProjectV1.
export interface MuseumMediaSource {
  id: string; title: string; publisher: string; url: string;
  accessedAt: string; accessStatus: 'readable'; note: string;
}
export interface MuseumMedia {
  id: string; kind: 'external' | 'original'; title: string; alt: string;
  description: string; sourceId: string | null; sourcePage: string | null;
  originalImage: string | null; localPath: string; sha256: string;
  width: number; height: number; bytes: number; credit: string; region: string;
  originalCaption: string; rightsStatus: 'unknown' | 'project-original'; rightsNote: string;
  decodedWith: string;
}
export interface MuseumMediaReading {
  exhibitId: string; lead: string; observation: string; mediaIds: string[];
  paragraphs: { title: string; text: string; sourceIds: string[] }[];
}
export interface MuseumMediaDocument {
  schemaVersion: 1; collectedAt: string;
  sources: MuseumMediaSource[]; media: MuseumMedia[]; exhibits: MuseumMediaReading[];
  unavailable: { url: string; note: string }[];
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && !/[<>]/.test(value);
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const https = (value: unknown) => typeof value === 'string' && /^https:\/\//.test(value);
const unique = (values: string[]) => new Set(values).size === values.length;

export function validateMuseumMedia(input: unknown): string[] {
  const errors: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
  if (!object(input) || input.schemaVersion !== 1 || !Array.isArray(input.sources) || !Array.isArray(input.media) || !Array.isArray(input.exhibits)) return ['museum media: schemaVersion 1 document required'];
  check(text(input.collectedAt), 'museum media: collection date required');
  const sources = new Map<string, ObjectValue>();
  for (const row of input.sources) {
    if (!object(row) || !text(row.id)) { check(false, 'museum media: source identity required'); continue; }
    check(!sources.has(row.id), `museum media: duplicate source ${row.id}`); sources.set(row.id, row);
    check(text(row.title) && text(row.publisher) && https(row.url) && text(row.accessedAt) && row.accessStatus === 'readable' && text(row.note), `museum media: source metadata ${row.id}`);
  }
  const media = new Map<string, ObjectValue>(), hashes = new Set<string>();
  for (const row of input.media) {
    if (!object(row) || !text(row.id)) { check(false, 'museum media: image identity required'); continue; }
    check(!media.has(row.id), `museum media: duplicate image ${row.id}`); media.set(row.id, row);
    check(['external', 'original'].includes(String(row.kind)), `museum media: image kind ${row.id}`);
    for (const field of ['title', 'alt', 'description', 'credit', 'region', 'originalCaption', 'rightsNote', 'decodedWith']) check(text(row[field]), `museum media: ${row.id}/${field} required`);
    check(typeof row.localPath === 'string' && /^\/assets\/[a-zA-Z0-9/_.-]+\.(png|jpg|jpeg|webp)$/.test(row.localPath) && !row.localPath.includes('..'), `museum media: local path ${row.id}`);
    check(typeof row.sha256 === 'string' && /^[a-f0-9]{64}$/.test(row.sha256), `museum media: sha256 ${row.id}`);
    check(!hashes.has(String(row.sha256)), `museum media: repeated image bytes ${row.id}`); hashes.add(String(row.sha256));
    for (const field of ['width', 'height', 'bytes']) check(Number.isInteger(row[field]) && Number(row[field]) > 0, `museum media: ${row.id}/${field} positive integer required`);
    if (row.kind === 'external') {
      const source = typeof row.sourceId === 'string' ? sources.get(row.sourceId) : undefined;
      check(source && row.sourcePage === source.url && https(row.originalImage), `museum media: checked external source ${row.id}`);
      check(row.rightsStatus === 'unknown', `museum media: unconfirmed external rights must stay unknown ${row.id}`);
    } else check(row.sourceId === null && row.sourcePage === null && row.originalImage === null && row.rightsStatus === 'project-original', `museum media: original attribution boundary ${row.id}`);
  }
  const seen = new Set<string>(), used = new Set<string>(); let placements = 0;
  for (const row of input.exhibits) {
    if (!object(row) || !text(row.exhibitId)) { check(false, 'museum media: exhibit identity required'); continue; }
    check(/^E0[1-8]$/.test(row.exhibitId) && !seen.has(row.exhibitId), `museum media: exhibit whitelist/duplicate ${row.exhibitId}`); seen.add(row.exhibitId);
    check(text(row.lead) && text(row.observation), `museum media: exhibit copy ${row.exhibitId}`);
    if (texts(row.mediaIds)) {
      check(row.mediaIds.length >= 2 && row.mediaIds.length <= 3 && unique(row.mediaIds) && row.mediaIds.every(id => media.has(id)), `museum media: 2-3 known images ${row.exhibitId}`);
      placements += row.mediaIds.length; for (const id of row.mediaIds) used.add(id);
    } else check(false, `museum media: image references ${row.exhibitId}`);
    if (!Array.isArray(row.paragraphs)) { check(false, `museum media: paragraphs ${row.exhibitId}`); continue; }
    check(row.paragraphs.length >= 2 && row.paragraphs.length <= 4, `museum media: paragraph count ${row.exhibitId}`);
    for (const paragraph of row.paragraphs) check(object(paragraph) && text(paragraph.title) && text(paragraph.text) && texts(paragraph.sourceIds) && unique(paragraph.sourceIds) && paragraph.sourceIds.every(id => sources.has(id)), `museum media: paragraph/source ${row.exhibitId}`);
    if (row.exhibitId === 'E08' && texts(row.mediaIds)) check(row.mediaIds.every(id => media.get(id)?.kind === 'original'), 'museum media: E08 project credits use original images');
  }
  check(seen.size === 8 && placements >= 16 && placements <= 24, 'museum media: eight exhibits and 16-24 placements required');
  check(used.size === media.size, 'museum media: unused image records');
  check([...used].filter(id => media.get(id)?.kind === 'external').length >= 12, 'museum media: at least 12 distinct external images required');
  check(Array.isArray(input.unavailable) && input.unavailable.every(row => object(row) && https(row.url) && text(row.note)), 'museum media: unavailable source notes required');
  return errors;
}

export function parseMuseumMedia(input: unknown): MuseumMediaDocument {
  const errors = validateMuseumMedia(input);
  if (errors.length) throw new Error(errors.join('\n'));
  return input as MuseumMediaDocument;
}
