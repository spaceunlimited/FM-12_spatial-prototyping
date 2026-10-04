// One way to draw a button, shared by Button, Prompt and Panel({ buttons }). A uikit Container
// with the guideline states: idle, hover, pressed, selected, disabled.
import { Container, Text } from '@pmndrs/uikit';
import { theme } from './theme';

export interface ButtonSpec {
  label: string;
  onSelect?: () => void;
  /** 'accent' for the one primary action; default is quiet. */
  variant?: 'default' | 'accent';
  disabled?: boolean;
  selected?: boolean;
}

export interface ButtonNode {
  node: Container;
  text: Text;
  setLabel(label: string): void;
  setDisabled(disabled: boolean): void;
  setSelected(selected: boolean): void;
  readonly disabled: boolean;
  readonly selected: boolean;
}

export function makeButtonNode(spec: ButtonSpec): ButtonNode {
  const state = { disabled: !!spec.disabled, selected: !!spec.selected };
  const accent = spec.variant === 'accent';
  const text = new Text({
    text: spec.label,
    fontSize: theme.fontBody,
    fontWeight: theme.fontWeightTitle,
    color: accent ? theme.buttonPressedText : theme.text,
    opacity: 1,
  });
  const node = new Container({
    minWidth: theme.minTarget,
    minHeight: theme.minTarget,
    paddingX: theme.padding * 0.8,
    paddingY: theme.padding * 0.4,
    borderRadius: theme.cornerRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent ? theme.accent : theme.button,
    cursor: 'pointer',
    hover: { backgroundColor: accent ? theme.accent : theme.buttonHover },
    active: { backgroundColor: theme.buttonPressed },
    onClick: () => {
      if (state.disabled) return;
      spec.onSelect?.();
    },
  });
  node.add(text);

  const paint = () => {
    const bg = state.selected ? theme.buttonSelected : accent ? theme.accent : theme.button;
    const fg = state.selected || accent ? theme.buttonPressedText : theme.text;
    node.setProperties({
      backgroundColor: bg,
      opacity: state.disabled ? theme.buttonDisabledOpacity : 1,
      hover: { backgroundColor: state.selected ? theme.buttonSelected : accent ? theme.accent : theme.buttonHover },
      cursor: state.disabled ? 'default' : 'pointer',
    });
    text.setProperties({ color: fg, opacity: state.disabled ? theme.buttonDisabledOpacity : 1 });
  };
  paint();

  return {
    node,
    text,
    setLabel: (label) => text.setProperties({ text: label }),
    setDisabled: (d) => {
      state.disabled = d;
      paint();
    },
    setSelected: (s) => {
      state.selected = s;
      paint();
    },
    get disabled() {
      return state.disabled;
    },
    get selected() {
      return state.selected;
    },
  };
}
