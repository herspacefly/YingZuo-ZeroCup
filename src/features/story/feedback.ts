import type { InteractionReading } from '../../story/node-interaction';

export interface StoryFeedbackInput {
  hasStory: boolean;
  error: boolean;
  blocked: boolean;
  ready: boolean;
  observing: boolean;
  playing: boolean;
  interactive: boolean;
  listening: boolean;
  choice: boolean;
  completed: boolean;
  resolving: boolean;
  reading: InteractionReading | null;
  holdMs: number | null;
}

export interface StoryFeedback {
  state: 'empty' | 'error' | 'saving' | 'loading' | 'observing' | 'paused' | 'listening' | 'choice' | 'ready' | 'holding' | 'lower-axe' | 'showcase' | 'complete';
  label: string;
  hint: string;
  progress: { value: number; max: number } | null;
}

/** Presentation only: the original interaction observer remains the sole completion authority. */
export function storyFeedback(input: StoryFeedbackInput): StoryFeedback {
  const state = (name: StoryFeedback['state'], label: string, hint: string, progress: StoryFeedback['progress'] = null): StoryFeedback =>
    ({ state: name, label, hint, progress });
  if (!input.hasStory) return state('empty', '', '');
  if (input.error) return state('error', '幕面暂未就绪', '请重试当前片段，进度仍会保留。');
  if (input.blocked) return state('saving', '正在处理作品', '完成保存或处理后，再继续这一段。');
  if (!input.ready) return state('loading', '正在准备幕面', '影偶与灯影就绪后，再接过这一幕。');
  if (input.observing) return state('observing', '正在看看幕后', '返回幕前后，点击继续，从这一刻接续。');
  if (input.completed) return state('complete', '动作完成', '这一刻已确认，准备进入下一段。');
  if (input.choice) return state('choice', '请你选择', '可随时选择去向，也可以继续听完这一段。');
  if (!input.playing) return state('paused', '片段已暂停', '点击继续；暂停不累计操偶时间。');
  if (input.resolving) return state('showcase', '定场放映', '动作已达标，接下来看看这一幕如何展开。');
  if (input.listening) return state('listening', '听戏中', input.interactive ? '对白结束后，再由你接过影偶。' : '听这一段故事，也可以随时暂停读台词。');
  if (input.reading?.phase === 'raised') return state('lower-axe', '现在落斧', '抬斧已稳住，保持身杆，再把持斧手落回身侧。');
  if (input.reading?.phase === 'holding') {
    const max = input.holdMs;
    const progress = max !== null && Number.isFinite(max) && max > 0
      ? { value: Math.max(0, Math.min(max, Number.isFinite(input.reading.heldMs) ? input.reading.heldMs : 0)), max } : null;
    return state('holding', '稳住这一刻', '已经进入目标，继续保持这个动作。', progress);
  }
  if (input.interactive) return state('ready', '轮到你操偶', '牵动握柄或使用下方按钮，让动作进入金色目标。');
  return state('listening', '听戏中', '这一段会按原节奏继续。');
}
