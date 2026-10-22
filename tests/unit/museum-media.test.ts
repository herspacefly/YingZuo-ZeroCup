import { describe, expect, it } from 'vitest';
import document from '../../src/content/museum-media.json';
import { parseMuseumMedia, validateMuseumMedia } from '../../src/content/museum-media';

describe('independent museum media catalogue', () => {
  it('keeps eight exhibits, real distinct external originals and honest attribution', () => {
    expect(validateMuseumMedia(document)).toEqual([]);
    const parsed = parseMuseumMedia(document), external = parsed.media.filter(row => row.kind === 'external');
    expect(external).toHaveLength(12);
    expect(new Set(external.map(row => row.sha256)).size).toBe(12);
    expect(external.every(row => row.rightsStatus === 'unknown' && row.sourcePage && row.originalImage)).toBe(true);
  });
  it('rejects dangling sources, invented external permission and copied bytes', () => {
    const broken = structuredClone(document); broken.media[0]!.sourceId = 'unread-page'; broken.media[1]!.rightsStatus = 'project-original'; broken.media[2]!.sha256 = broken.media[0]!.sha256;
    expect(validateMuseumMedia(broken)).toEqual(expect.arrayContaining([expect.stringContaining('checked external source'), expect.stringContaining('unconfirmed external rights'), expect.stringContaining('repeated image bytes')]));
  });
  it('rejects missing images, unsafe local paths and external pictures in project credit', () => {
    const broken = structuredClone(document); broken.media[0]!.localPath = '/assets/../../outside.png'; broken.exhibits[0]!.mediaIds = ['missing']; broken.exhibits[7]!.mediaIds = ['tangshan-sheng', 'original-mother-head'];
    const problems = validateMuseumMedia(broken);
    expect(problems).toEqual(expect.arrayContaining([expect.stringContaining('local path'), expect.stringContaining('2-3 known images'), expect.stringContaining('E08 project credits')]));
    expect(() => parseMuseumMedia(broken)).toThrow();
  });
});
