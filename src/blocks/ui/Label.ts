/**
 * @block Label
 * A short caption that rides on an object: a pill of text that faces the viewer and grows upward
 * from its anchor, so it never sinks into what it names.
 * @option text string — the caption (first constructor argument)
 * @method attachTo(object, { offset? = [0, 0.16, 0] }) — ride on an object
 * @method setText(text)
 * @method dispose()
 */
import { Text } from '@pmndrs/uikit';
import { theme } from './theme';
import { UIBlock, type UIBlockOptions } from './UIBlock';

export interface LabelOptions extends UIBlockOptions {
  color?: string;
  backgroundColor?: string;
}

export class Label extends UIBlock {
  private node: Text;

  constructor(text: string, opts: LabelOptions = {}) {
    super(
      {
        paddingX: theme.padding * 0.7,
        paddingY: theme.padding * 0.4,
        borderRadius: theme.cornerRadius,
        backgroundColor: opts.backgroundColor ?? theme.backing,
        opacity: theme.backingOpacity, // inherited by children, so the text sets its own below
        maxWidth: theme.panelWidth,
      },
      { anchor: 'bottom', ...opts },
    );
    this.name = 'Label';
    this.node = new Text({
      text,
      fontSize: theme.fontCaption,
      fontWeight: theme.fontWeightTitle,
      color: opts.color ?? theme.text,
      opacity: 1,
      wordBreak: 'break-word',
      textAlign: 'center',
    });
    this.root.add(this.node);
  }

  attachTo(object: import('three').Object3D, opts: { offset?: [number, number, number] } = {}): this {
    return super.attachTo(object, { offset: opts.offset ?? [0, 0.16, 0] });
  }

  setText(text: string) {
    this.node.setProperties({ text });
  }
}
