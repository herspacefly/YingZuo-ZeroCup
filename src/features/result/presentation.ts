import { definitionFor } from '../../content/reunion';
import { choiceSummary, resolveEnding } from '../../domain/story-choices';
import type { EndingId } from '../../domain/types';
import type { ReunionArtifact } from './artifact';

export interface ProgrammeDecision { label: string; value: string; decisive: boolean }
export interface ResultPresentation {
  title: string; summary: string; stamp: string; accent: string;
  explanation: string; decisions: ProgrammeDecision[];
}

const themes: Record<EndingId, { stamp: string; accent: string }> = {
  home: { stamp: '归家', accent: '#9f3a2c' },
  light: { stamp: '守灯', accent: '#986517' },
  road: { stamp: '同行', accent: '#365d58' },
  waiting: { stamp: '相守', accent: '#65516b' },
  sacrifice: { stamp: '化山', accent: '#505c69' },
};

/** One read-only interpretation for the page and its PNG; never derives a new story decision. */
export function createResultPresentation(summary: ReunionArtifact['summary']): ResultPresentation {
  const ending = summary.ending ? definitionFor(summary).endings!.find(item => item.id === summary.ending)! : null;
  const result: ResultPresentation = {
    title: ending?.title ?? '一幕团圆',
    summary: ending?.summary ?? '把母子相见的这一刻，留在同一张幕上。',
    ...(summary.ending ? themes[summary.ending] : { stamp: '团圆', accent: '#9f3a2c' }),
    explanation: '', decisions: [],
  };
  const choices = summary.choices;
  if (!choices?.journeyIntent || !choices.mountainPact || !choices.finalAction ||
    resolveEnding(choices.journeyIntent, choices.mountainPact, summary.approach, choices.finalAction) !== summary.ending) {
    throw new Error('本场四次选择与终章不一致，未生成节目单说明。');
  }
  let decisive: number[];
  switch (summary.ending) {
    case 'waiting':
      decisive = [3];
      result.explanation = '你在最后暂缓落斧，留下灯火与回应。此前的愿望和承山约定没有替你落下最后一斧；封印仍未解开，母亲仍不能离开。';
      break;
    case 'sacrifice':
      decisive = [1, 3];
      result.explanation = '你选择独自承山，并在最后继续兑现约定。沉香永久化为山影，失去归家与人间生活的未来，母亲恢复自由。';
      break;
    case 'road':
      decisive = [1, 2, 3];
      result.explanation = '你选择共同承山、先挥斧开山，并继续解印。母亲恢复自由，与你同行认路。';
      break;
    case 'home':
      decisive = [0, 1, 2, 3];
      result.explanation = '你选择接母亲回家、共同承山、先举灯呼唤，并在最后继续解印。母子自由地牵手回家。';
      break;
    case 'light':
      decisive = [0, 1, 2, 3];
      result.explanation = '你选择为后来人留路、共同承山、先举灯呼唤，并继续解印。母亲恢复自由后自愿守灯，彼此可以自由来去。';
      break;
    default: throw new Error('本场缺少终章，未生成节目单说明。');
  }
  result.decisions = choiceSummary(summary).map((item, index) => ({ ...item, decisive: decisive.includes(index) }));
  return result;
}

/** Measure actual glyph widths; exported images wrap without squeezing the text horizontally. */
export function wrapProgrammeText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = char; }
      else line += char;
    }
    lines.push(line);
  }
  return lines;
}
