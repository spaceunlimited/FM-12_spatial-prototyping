import { stage, recenter, onLongPress, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
cube.position.set(0.2, 0, 0); // 20 cm to the right of the stage centre
stage.add(cube);

// Hold anywhere for 0.75 s to bring the stage back in front of the viewer.
onLongPress('anywhere', () => recenter());
