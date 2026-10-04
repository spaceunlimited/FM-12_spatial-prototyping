import { place, THREE } from '@blocks';

const plant = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
const result = place(plant, {
  strategy: 'auto', // surface where the device finds one, otherwise in front
  onPlaced: (r) => console.log(r.used, '—', r.explanation),
});
void result;
