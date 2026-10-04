import { Prompt, stage } from '@blocks';

// Trails the viewer by default and disappears after a choice.
const prompt = new Prompt({
  text: 'Which planet?',
  options: ['Earth', 'Mars'],
  onChoose: (i, label) => console.log('chose', i, label),
});
stage.add(prompt);
