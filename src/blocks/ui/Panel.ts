/**
 * @block Panel
 * A floating text panel: optional title, body text, optional row of buttons. Reads over a camera
 * feed or passthrough, faces the viewer, keeps its visual size at any distance.
 * @option title string — bold first line
 * @option text string — body text; word-wrapped
 * @option width number = 0.42 — metres at 1 m (max 0.7)
 * @option buttons ButtonSpec[] — { label, onSelect, variant?: 'accent' } rendered in a row below the text
 * @option follow 'world' | 'lazy' | 'object' = 'world' — 'lazy' trails the viewer at `distance`
 * @option distance number = 1.5 — metres, for follow: 'lazy'
 * @option anchor 'center' | 'bottom' = 'center' — 'bottom' grows upward from its position
 * @method setText(text, { typewriter?, cps? = 40 }) — replace the body; typewriter reveals it like model output
 * @method setTitle(title)
 * @method attachTo(object, { offset? = [0, 0.2, 0] }) — ride on an object
 * @method dispose()
 */
import { Container, Text } from '@pmndrs/uikit';
import { theme } from './theme';
import { UIBlock, type UIBlockOptions } from './UIBlock';
import { makeButtonNode, type ButtonNode, type ButtonSpec } from './button-node';

export interface PanelOptions extends UIBlockOptions {
  title?: string;
  text?: string;
  /** Metres at 1 m. Default theme.panelWidth / 1000, max theme.panelMaxWidth / 1000. */
  width?: number;
  buttons?: ButtonSpec[];
  /** Override the guideline look for one panel. */
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
}

export class Panel extends UIBlock {
  private titleNode: Text;
  private bodyNode: Text;
  private buttonRow: Container | null = null;
  readonly buttons: ButtonNode[] = [];
  private typeTimer: ReturnType<typeof setInterval> | null = null;
  private fullText = '';

  constructor(opts: PanelOptions = {}) {
    const widthPx = Math.min(Math.round((opts.width ?? theme.panelWidth / 1000) * 1000), theme.panelMaxWidth);
    super(
      {
        width: widthPx,
        flexDirection: 'column',
        gap: theme.gap,
        padding: theme.padding,
        borderRadius: theme.cornerRadius,
        backgroundColor: opts.backgroundColor ?? theme.backing,
        opacity: opts.backgroundOpacity ?? theme.backingOpacity, // inherited; text and buttons set their own
      },
      opts,
    );
    this.name = 'Panel';
    const color = opts.textColor ?? theme.text;
    this.titleNode = new Text({
      text: opts.title ?? '',
      fontSize: theme.fontTitle,
      fontWeight: theme.fontWeightTitle,
      lineHeight: theme.lineHeight,
      color,
      opacity: 1,
      wordBreak: 'break-word',
      display: opts.title ? 'flex' : 'none',
    });
    this.bodyNode = new Text({
      text: opts.text ?? '',
      fontSize: theme.fontBody,
      fontWeight: theme.fontWeightBody,
      lineHeight: theme.lineHeight,
      color,
      opacity: 1,
      wordBreak: 'break-word',
      display: opts.text ? 'flex' : 'none',
    });
    this.fullText = opts.text ?? '';
    this.root.add(this.titleNode, this.bodyNode);
    if (opts.buttons?.length) this.setButtons(opts.buttons);
  }

  /** Replace the body text. With typewriter, it reveals character by character like model output. */
  setText(text: string, opts: { typewriter?: boolean; cps?: number } = {}) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.typeTimer = null;
    this.fullText = text;
    this.bodyNode.setProperties({ display: text ? 'flex' : 'none' });
    if (!opts.typewriter) {
      this.bodyNode.setProperties({ text });
      return;
    }
    const cps = opts.cps ?? 40;
    let i = 0;
    this.bodyNode.setProperties({ text: '' });
    this.typeTimer = setInterval(() => {
      i = Math.min(text.length, i + 1);
      this.bodyNode.setProperties({ text: text.slice(0, i) });
      if (i >= text.length && this.typeTimer) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
      }
    }, 1000 / cps);
  }

  get text() {
    return this.fullText;
  }

  setTitle(title: string) {
    this.titleNode.setProperties({ text: title, display: title ? 'flex' : 'none' });
  }

  /** Replace the row of buttons under the text. */
  setButtons(specs: ButtonSpec[]) {
    if (this.buttonRow) {
      this.root.remove(this.buttonRow);
      this.buttonRow.dispose();
      this.buttons.length = 0;
    }
    this.buttonRow = new Container({ flexDirection: 'row', flexWrap: 'wrap', gap: theme.gap, marginTop: theme.gap / 2, opacity: 1 });
    for (const spec of specs) {
      const b = makeButtonNode(spec);
      this.buttons.push(b);
      this.buttonRow.add(b.node);
    }
    this.root.add(this.buttonRow);
  }

  dispose() {
    if (this.typeTimer) clearInterval(this.typeTimer);
    super.dispose();
  }
}
