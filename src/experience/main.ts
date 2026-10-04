// The experience. This is the file you change. Everything it needs comes from '@blocks';
// see CAPABILITIES.md for every block and a snippet to copy.
import { startExperience, stage, draggable, place, onSelect, Panel, Label, ai, THREE } from '@blocks';
import responses from './content/responses.json';

startExperience(
  ({ profile }) => {
    ai.fake(responses);

    // One object on the stage, draggable.
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.6 }),
    );
    cube.name = 'cube';
    stage.add(cube);
    draggable(cube);
    new Label(profile.capabilities.hands ? 'Pinch me' : 'Tap me').attachTo(cube, { offset: [0, 0.14, 0] });

    // One object placed in the room: on a real surface where the device finds one, else in front.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 }));
    cone.name = 'cone';
    cone.position.y = 0.09; // stand on its base
    const holder = new THREE.Group();
    holder.name = 'placed';
    holder.add(cone);
    place(holder, { distance: 1.2, heightOffset: -0.5, onPlaced: (r) => (holder.userData.placed = r) });

    // One panel, above the cube.
    const panel = new Panel({ title: 'Hello', text: 'Select the cube to ask the AI something.' });
    panel.position.set(0, 0.42, 0);
    stage.add(panel);

    // One fake AI reply.
    onSelect(cube, async () => {
      if (ai.isThinking) return;
      panel.setText('…');
      const reply = await ai.ask('hello');
      panel.setText(reply, { typewriter: true });
    });
  },
  { title: 'XR sandbox' },
);
