// Shared JSON checker. No runtime imports so Node 24 can check the same contract.
const expected: Record<string, { section: string; demo: string }> = {
  E01: { section: '一张皮', demo: 'layers' }, E02: { section: '一道刻', demo: 'carving' },
  E03: { section: '一道刻', demo: 'joints' }, E04: { section: '一束光', demo: 'light' },
  E05: { section: '一双手', demo: 'ensemble' }, E06: { section: '一出戏', demo: 'adaptation' },
  E07: { section: '一出戏', demo: 'regions' },
};
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(string);
const unique = (v: string[]) => new Set(v).size === v.length;
const prose = (v: unknown, min: number, max: number) => string(v) && Array.from(v).length >= min && Array.from(v).length <= max && !/[<>]/.test(v);

export function validateMuseumContent(exhibits: unknown, facts: unknown, sources: unknown): string[] {
  const errors: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
  const document = (input: unknown, key: string): unknown[] => {
    if (!record(input) || input.schemaVersion !== 1 || !Array.isArray(input[key])) {
      errors.push(`museum ${key}: schemaVersion 1 document required`); return [];
    }
    return input[key];
  };
  const exhibitRows = document(exhibits, 'exhibits');
  const factRows = document(facts, 'facts');
  const sourceRows = document(sources, 'sources');
  const sourceMap = new Map<string, RecordValue>();
  for (const source of sourceRows) {
    if (!record(source) || !string(source.id)) { check(false, 'museum source: invalid identity'); continue; }
    check(!sourceMap.has(source.id), `museum source duplicate ${source.id}`);
    sourceMap.set(source.id, source);
    check(string(source.title) && string(source.publisher) && string(source.url) && /^https?:\/\//.test(source.url), `museum source metadata ${source.id}`);
  }
  const references = (value: unknown, at: string, known: Map<string, unknown>, min = 0, max = 3): string[] => {
    if (!strings(value)) { check(false, `${at}: string references required`); return []; }
    check(unique(value) && value.length >= min && value.length <= max && value.every(id => known.has(id)), `${at}: duplicate, missing or unknown reference`);
    return value;
  };
  const factMap = new Map<string, RecordValue>();
  for (const fact of factRows) {
    if (!record(fact) || !string(fact.id)) { check(false, 'museum fact: invalid identity'); continue; }
    check(!factMap.has(fact.id), `museum fact duplicate ${fact.id}`);
    factMap.set(fact.id, fact);
    check(['culture', 'model', 'original'].includes(String(fact.kind)), `museum fact kind ${fact.id}`);
    check(prose(fact.text, 8, 220), `museum fact prose ${fact.id}`);
    check(typeof fact.kind === 'string' && fact.id.startsWith(`${fact.kind}-`), `museum fact identity/kind boundary ${fact.id}`);
    const ids = references(fact.sourceIds, `museum fact sources ${fact.id}`, sourceMap, fact.kind === 'culture' ? 1 : 0);
    if (fact.kind === 'culture') {
      for (const id of ids) {
        const source = sourceMap.get(id);
        check(source && ['page', 'official-search-index'].includes(String(source.verificationMethod)) &&
          (source.verificationMethod !== 'page' || source.accessStatus === 'readable') &&
          strings(source.supportedFacts) && source.supportedFacts.length > 0,
        `museum culture source lacks checked evidence ${fact.id}/${id}`);
      }
    } else check(ids.length === 0, `museum ${String(fact.kind)} must not imply external backing ${fact.id}`);
  }
  check(factRows.length > 0, 'museum facts required');
  const seen = new Set<string>(), usedFacts = new Set<string>();
  for (const exhibit of exhibitRows) {
    if (!record(exhibit) || !string(exhibit.id)) { check(false, 'museum exhibit: invalid identity'); continue; }
    const id = exhibit.id, contract = expected[id];
    check(contract && !seen.has(id), `museum exhibit whitelist/duplicate ${id}`); seen.add(id);
    check(contract && exhibit.section === contract.section && exhibit.demo === contract.demo, `museum section/demo ${id}`);
    check(prose(exhibit.title, 2, 40) && prose(exhibit.question, 2, 60), `museum heading ${id}`);
    check(prose(exhibit.summary, 40, 70), `museum summary 40-70 Unicode codepoints ${id}`);
    check(prose(exhibit.detail, 120, 180), `museum detail 120-180 Unicode codepoints ${id}`);
    check(prose(exhibit.alt, 8, 180), `museum alternative text ${id}`);
    const sourceIds = references(exhibit.sourceIds, `museum exhibit sources ${id}`, sourceMap, 1);
    const factIds = references(exhibit.factIds, `museum exhibit facts ${id}`, factMap, 1, 10);
    for (const factId of factIds) {
      usedFacts.add(factId);
      const fact = factMap.get(factId);
      if (fact && strings(fact.sourceIds)) check(fact.sourceIds.every(sourceId => sourceIds.includes(sourceId)), `museum fact/source mapping ${id}/${factId}`);
    }
    if (!Array.isArray(exhibit.panels)) { check(false, `museum panels required ${id}`); continue; }
    const minPanels = id === 'E05' ? 4 : ['E06', 'E07'].includes(id) ? 3 : 0;
    check(exhibit.panels.length >= minPanels && exhibit.panels.length <= 6 && (id !== 'E07' || exhibit.panels.length === 3), `museum panel count ${id}`);
    const panelTitles = new Set<string>();
    for (const panel of exhibit.panels) {
      if (!record(panel)) { check(false, `museum malformed panel ${id}`); continue; }
      check(prose(panel.title, 2, 40) && prose(panel.text, 8, 180) && typeof panel.title === 'string' && !panelTitles.has(panel.title), `museum panel prose/title ${id}`);
      if (typeof panel.title === 'string') panelTitles.add(panel.title);
      const ids = references(panel.sourceIds, `museum panel sources ${id}`, sourceMap);
      check(ids.every(sourceId => sourceIds.includes(sourceId)), `museum panel/source mapping ${id}`);
    }
  }
  check(seen.size === 7 && Object.keys(expected).every(id => seen.has(id)) && exhibitRows.length === 7, 'museum exact E01-E07 required');
  check([...factMap.keys()].every(id => usedFacts.has(id)), 'museum unreferenced facts');
  return errors;
}
