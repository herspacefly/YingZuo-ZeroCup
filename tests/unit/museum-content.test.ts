import { describe, expect, it } from 'vitest';
import exhibits from '../../src/content/exhibits.json';
import facts from '../../src/content/facts.json';
import sources from '../../src/content/sources.json';
import { museumExhibits, museumFacts, museumSections } from '../../src/content/museum';
import { validateMuseumContent } from '../../src/content/museum-contract';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
describe('T18 museum content and evidence boundary', () => {
  it('provides the five-section/seven-exhibit consumer contract with checked references', () => {
    expect(validateMuseumContent(exhibits, facts, sources)).toEqual([]);
    expect(museumExhibits).toEqual(exhibits.exhibits);
    expect(museumFacts).toEqual(facts.facts);
    expect(new Set(museumExhibits.map(exhibit => exhibit.section))).toEqual(new Set(museumSections));
  });
  it('requires versioned documents and safely rejects malformed unknown input', () => {
    for (const invalid of [null, [], {}, { schemaVersion: 2, exhibits: [] }, { schemaVersion: 1, exhibits: [null, 'E01', {}] }]) {
      expect(validateMuseumContent(invalid, facts, sources).length).toBeGreaterThan(0);
    }
    expect(validateMuseumContent(exhibits, null, sources).length).toBeGreaterThan(0);
    expect(validateMuseumContent(exhibits, facts, null).length).toBeGreaterThan(0);
  });
  it('rejects duplicate, missing, unknown and mismatched exhibit identities', () => {
    for (const mutate of [
      (value: typeof exhibits) => { value.exhibits.pop(); },
      (value: typeof exhibits) => { value.exhibits[6]!.id = 'E01'; },
      (value: typeof exhibits) => { value.exhibits[0]!.id = 'E09'; },
      (value: typeof exhibits) => { value.exhibits[0]!.section = '一出戏'; },
      (value: typeof exhibits) => { value.exhibits[0]!.demo = 'audio'; },
    ]) {
      const value = copy(exhibits); mutate(value);
      expect(validateMuseumContent(value, facts, sources).length).toBeGreaterThan(0);
    }
  });
  it('counts reading layers as Unicode codepoints and requires useful alternative text', () => {
    const value = copy(exhibits);
    value.exhibits[0]!.summary = '影'.repeat(39) + '🎭';
    value.exhibits[0]!.detail = '影'.repeat(119) + '🎭';
    expect(validateMuseumContent(value, facts, sources)).toEqual([]);
    value.exhibits[0]!.summary = '影'.repeat(39);
    value.exhibits[0]!.detail = '影'.repeat(181);
    value.exhibits[0]!.alt = '';
    const errors = validateMuseumContent(value, facts, sources);
    expect(errors.some(error => error.includes('summary'))).toBe(true);
    expect(errors.some(error => error.includes('detail'))).toBe(true);
    expect(errors.some(error => error.includes('alternative'))).toBe(true);
  });
  it('rejects dangling fact/source references, omissions from an exhibit and orphan facts', () => {
    const value = copy(exhibits);
    value.exhibits[0]!.factIds.push('culture-invented');
    value.exhibits[2]!.sourceIds = ['C6'];
    value.exhibits[6]!.panels[0]!.sourceIds = ['C3'];
    value.exhibits[6]!.factIds = ['original-regions'];
    const errors = validateMuseumContent(value, facts, sources);
    expect(errors.some(error => error.includes('unknown reference'))).toBe(true);
    expect(errors.some(error => error.includes('fact/source mapping'))).toBe(true);
    expect(errors.some(error => error.includes('panel/source mapping'))).toBe(true);
    expect(errors.some(error => error.includes('unreferenced facts'))).toBe(true);
  });
  it('requires checked evidence for cultural claims, preserving honest indexed-source access', () => {
    const missing = copy(facts); missing.facts[0]!.sourceIds = [];
    expect(validateMuseumContent(exhibits, missing, sources).some(error => error.includes('fact sources'))).toBe(true);
    const unverified = copy(sources); unverified.sources.find(source => source.id === 'C2')!.verificationMethod = 'unverified';
    expect(validateMuseumContent(exhibits, facts, unverified).some(error => error.includes('lacks checked evidence'))).toBe(true);
    const unread = copy(sources); unread.sources.find(source => source.id === 'C2')!.accessStatus = 'blocked';
    expect(validateMuseumContent(exhibits, facts, unread).some(error => error.includes('lacks checked evidence'))).toBe(true);
    expect(sources.sources.find(source => source.id === 'C3')).toMatchObject({ accessStatus: 'blocked', verificationMethod: 'official-search-index' });
  });
  it('keeps model/original statements and user-confirmed credits separate from external backing', () => {
    const value = copy(facts); value.facts.find(fact => fact.kind === 'model')!.sourceIds = ['C2'];
    expect(validateMuseumContent(exhibits, value, sources).some(error => error.includes('external backing'))).toBe(true);
    const mislabeled = copy(facts); mislabeled.facts[0]!.kind = 'original'; mislabeled.facts[0]!.sourceIds = [];
    expect(validateMuseumContent(exhibits, mislabeled, sources).some(error => error.includes('identity/kind boundary'))).toBe(true);
    expect(museumExhibits.some(exhibit=>exhibit.id==='E08')).toBe(false);
  });
  it('requires collaboration, adaptation, regional and credit panels instead of empty displays', () => {
    for (const id of ['E05', 'E06', 'E07']) {
      const value = copy(exhibits); value.exhibits.find(exhibit => exhibit.id === id)!.panels = [];
      expect(validateMuseumContent(value, facts, sources).some(error => error.includes(`panel count ${id}`))).toBe(true);
    }
  });
});
