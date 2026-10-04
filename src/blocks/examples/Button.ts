import { Button, stage } from '@blocks';

const again = new Button({ label: 'Again', variant: 'accent', onSelect: () => console.log('again!') });
again.position.set(0, -0.2, 0);
stage.add(again);
again.setDisabled(false);
