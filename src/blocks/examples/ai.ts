import { ai, onSelect, Panel, stage, THREE } from '@blocks';

ai.fake({
  hello: ['Hi there!', 'Hello again.'],
  '/planet|mars/': 'Mars is the red one.',
  '*': 'I did not catch that.',
});

const panel = new Panel({ text: 'Select the cube.' });
stage.add(panel);
const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
cube.position.y = -0.3;
stage.add(cube);

ai.on('thinking', () => panel.setText('…'));
ai.on('reply', ({ text }) => panel.setText(text, { typewriter: true }));
onSelect(cube, () => ai.ask('tell me about mars'));
// ai.mode = 'live';  // real model through the proxy once a key is in .env; falls back to fake without one
