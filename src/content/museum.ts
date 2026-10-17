import exhibits from './exhibits.json';
import facts from './facts.json';
import type { ExhibitId } from '../domain/types';

export type ExhibitDemo = 'layers' | 'carving' | 'joints' | 'light' | 'ensemble' | 'adaptation' | 'regions' | 'credits';
export interface MuseumExhibit {
  id: ExhibitId; section: string; title: string; question: string;
  summary: string; detail: string; alt: string; demo: ExhibitDemo;
  factIds: string[]; sourceIds: string[];
  panels: { title: string; text: string; sourceIds: string[] }[];
}
export interface MuseumFact {
  id: string; kind: 'culture' | 'model' | 'original'; text: string; sourceIds: string[];
}
export const museumSections = ['一张皮', '一道刻', '一束光', '一双手', '一出戏'] as const;
export const museumExhibits = exhibits.exhibits as MuseumExhibit[];
export const museumFacts = facts.facts as MuseumFact[];
