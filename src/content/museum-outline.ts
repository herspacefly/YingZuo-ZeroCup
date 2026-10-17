import type { ExhibitId } from '../domain/types';
// T02 navigation outline from the story bible. T18 owns full exhibit copy/demos;
// opening this outline does not mean the actual exhibit has been visited.
export const museumSections = ['一张皮', '一道刻', '一束光', '一双手', '一出戏'] as const;
export const museumOutline: { id: ExhibitId; section: typeof museumSections[number]; title: string; question: string }[] = [
  { id: 'E01', section: '一张皮', title: '颜色为什么能透出来', question: '一张皮，怎样留住一束光？' },
  { id: 'E02', section: '一道刻', title: '刻掉的地方留下什么', question: '少一笔，影子里会多出什么？' },
  { id: 'E03', section: '一道刻', title: '一只影偶怎样动起来', question: '关节与三根杆，怎样一起回应手？' },
  { id: 'E04', section: '一束光', title: '一盏灯，两种尺度', question: '灯挪一挪，幕上会发生什么？' },
  { id: 'E05', section: '一双手', title: '台上两个人，幕后多少双手', question: '一出戏，需要怎样的配合？' },
  { id: 'E06', section: '一出戏', title: '这出《劈山救母》从哪里来', question: '哪些来自故事，哪些属于这次创作？' },
  { id: 'E07', section: '一出戏', title: '同是皮影，各地不同', question: '从不同地方，走进同一张幕。' },
  { id: 'E08', section: '一双手', title: '刚才这一场由谁完成', question: '把这一场的参与，看得更清楚。' },
];
