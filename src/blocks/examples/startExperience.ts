import { startExperience, stage, THREE } from '@blocks';

startExperience(
  ({ profile }) => {
    // Everything you add to `stage` appears 1.5 m in front of the viewer.
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
    stage.add(ball);
    if (profile.capabilities.hands) console.log('hands are tracked on this device');
  },
  { title: 'My demo' },
);
