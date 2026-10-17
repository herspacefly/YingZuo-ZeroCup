import type { EditorCommand } from './commands';
import type { ProjectStore, SaveResult, StoreState } from './store';
import type { AppRoute } from './router';

export interface PageContext {
  store: ProjectStore; route: AppRoute;
  navigate(route: AppRoute): void;
  isBusy():boolean;
  run(job: () => Promise<unknown>): Promise<void>;
  edit(command: EditorCommand): void;
  start(mode: 'full' | 'guided'): void;
  skipIntro(): void;
  notify(text: string): void;
  durable(job: () => Promise<SaveResult>, next?: AppRoute): Promise<void>;
}
export interface PageView { update(state: StoreState): void; dispose(): void }
export type PageFactory = (host: HTMLElement, context: PageContext) => PageView;
