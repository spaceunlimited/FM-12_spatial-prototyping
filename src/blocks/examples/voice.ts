import { voice, Panel, stage } from '@blocks';

const panel = new Panel({ text: 'Say hello' });
stage.add(panel);

// Listens where the browser can; shows tappable phrases where it cannot (headsets, some phones).
voice.listen({
  fallbackPhrases: ['hello', 'next'],
  onResult: (text, final) => {
    if (final && /hello/i.test(text)) {
      panel.setText('Hello back!');
      voice.speak('Hello back!');
    }
  },
});
