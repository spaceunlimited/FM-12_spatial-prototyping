import { onSelect, onPoint, onLongPress, onPoke, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

onSelect(cube, (e) => console.log('selected by', e.kind, 'at', e.point));
onPoint(cube, {
  enter: () => cube.scale.setScalar(1.1),
  leave: () => cube.scale.setScalar(1),
  dwellMs: 1500,
  dwell: () => console.log('looked at it for 1.5 s'),
});
onLongPress(cube, () => console.log('held'), { ms: 750 });
onPoke(cube, { release: () => console.log('poked') });
onSelect('anywhere', () => console.log('tapped on nothing'));
