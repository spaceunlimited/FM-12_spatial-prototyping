/**
 * @block Button
 * A single tappable / pinchable button in the room, at least 6 cm wide at 1 m, with hover,
 * pressed, selected and disabled states.
 * @option label string
 * @option onSelect () => void
 * @option variant 'default' | 'accent' = 'default' — accent for the one primary action
 * @option disabled boolean = false
 * @option selected boolean = false
 * @method setLabel(label) · setDisabled(bool) · setSelected(bool) · attachTo(object, { offset }) · dispose()
 */
import { UIBlock, type UIBlockOptions } from './UIBlock';
import { makeButtonNode, type ButtonNode, type ButtonSpec } from './button-node';

export interface ButtonOptions extends ButtonSpec, UIBlockOptions {}

export class Button extends UIBlock {
  private inner: ButtonNode;

  constructor(opts: ButtonOptions) {
    super({ flexDirection: 'row' }, opts);
    this.name = 'Button';
    this.inner = makeButtonNode(opts);
    this.root.add(this.inner.node);
  }
  setLabel(label: string) {
    this.inner.setLabel(label);
  }
  setDisabled(disabled: boolean) {
    this.inner.setDisabled(disabled);
  }
  setSelected(selected: boolean) {
    this.inner.setSelected(selected);
  }
  get disabled() {
    return this.inner.disabled;
  }
  get selected() {
    return this.inner.selected;
  }
}
