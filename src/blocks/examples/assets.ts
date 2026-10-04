import { model, image, video, place, stage, onSelect, voice } from '@blocks';

// Files live in public/: public/models/robot.glb is '/models/robot.glb'.
const robot = await model('/models/robot.glb', { size: 0.3, anchor: 'bottom' });
place(robot); // on a real surface where the device finds one, else floating in front

const poster = await image('/images/poster.jpg', { width: 0.3 });
poster.position.set(-0.35, 0.2, 0);
stage.add(poster);

const clip = await video('/video/intro.mp4', { width: 0.4 });
clip.position.set(0.35, 0.2, 0);
stage.add(clip);
onSelect(clip, () => (clip.video.paused ? clip.play() : clip.pause()));

void voice.playClip('/voice/hello.mp3'); // sound: a clip from public/, see voice
