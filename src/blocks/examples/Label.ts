import { Label, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

const label = new Label('Cube').attachTo(cube, { offset: [0, 0.1, 0] });
label.setText('Still a cube');
