import { draggable, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

const stop = draggable(cube, { scale: true, onDrop: (o) => console.log('dropped at', o.position) });
// later: stop();
void stop;
