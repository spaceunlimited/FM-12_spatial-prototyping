/**
 * @block Prompt
 * A question with a row of choices. The viewer taps or pinches one; the chosen button stays
 * highlighted. Use it wherever a demo needs an answer and voice is not available.
 * @option text string — the question
 * @option options string[] — the choices, one button each
 * @option onChoose (index, label) => void
 * @option follow 'world' | 'lazy' | 'object' = 'lazy' — a prompt trails the viewer by default
 * @method choose(index) — select programmatically · setDisabled(bool) · dispose()
 */
import { theme } from './theme';
import { Panel, type PanelOptions } from './Panel';

export interface PromptOptions extends Omit<PanelOptions, 'buttons' | 'title'> {
  text: string;
  options: string[];
  onChoose?: (index: number, label: string) => void;
  /** Keep the prompt after a choice (default false: it disappears). */
  keep?: boolean;
}

export class Prompt extends Panel {
  private chosen = -1;

  constructor(opts: PromptOptions) {
    super({
      follow: 'lazy',
      distance: theme.distance,
      ...opts,
      text: opts.text,
      buttons: opts.options.map((label, i) => ({ label, onSelect: () => this.choose(i) })),
    });
    this.onChoose = opts.onChoose;
    this.keep = !!opts.keep;
    this.labels = [...opts.options];
    this.name = 'Prompt';
  }
  private onChoose?: (index: number, label: string) => void;
  private keep: boolean;
  private labels: string[];

  choose(index: number) {
    if (this.chosen >= 0 && !this.keep) return;
    this.chosen = index;
    this.buttons.forEach((b, i) => b.setSelected(i === index));
    this.onChoose?.(index, this.labels[index] ?? String(index));
    if (!this.keep) setTimeout(() => this.dispose(), theme.feedbackMs * 3);
  }

  setDisabled(disabled: boolean) {
    for (const b of this.buttons) b.setDisabled(disabled);
  }
}
