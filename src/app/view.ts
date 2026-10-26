import type { EditorCommand } from './commands';
import type { ProjectStore, SaveResult, StoreState } from './store';
import type { AppRoute } from './router';
import type { StageSoundSample } from '../audio/stage-sound';
import type { StageAudioSession } from '../audio/stage-session';

export interface PageContext {
  guide?: 'page'|'puppetry';
  store: ProjectStore; route: AppRoute;
  navigate(route: AppRoute): void;
  isBusy():boolean;
  run(job: () => Promise<unknown>): Promise<void>;
  edit(command: EditorCommand): void;
  start(mode: 'full' | 'guided'): void;
  skipIntro(): void;
  notify(text: string): void;
  musicSample?(sample: StageSoundSample | null): void;
  audio?: StageAudioSession;
  durable(job: () => Promise<SaveResult>, next?: AppRoute): Promise<void>;
}
export interface PageView { suspendForGuide?():()=>void; update(state: StoreState): void; dispose(): void }
export type PageFactory = (host: HTMLElement, context: PageContext) => PageView;
