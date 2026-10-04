import { Panel, stage } from '@blocks';

const panel = new Panel({
  title: 'Welcome',
  text: 'Select the cube to begin.',
  buttons: [{ label: 'Skip', onSelect: () => panel.setText('Skipped.') }],
});
panel.position.set(0, 0.4, 0); // 40 cm above the stage centre
stage.add(panel);

panel.setText('Thinking…');
panel.setText('Here is a longer reply, typed out like a model would.', { typewriter: true });
