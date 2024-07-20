import { AudioManager, CompositeDrawable, resolved } from 'osucad-framework';
import gsap from 'gsap';
import { EditorMixer } from './editor/EditorMixer';

export class GlobalSongPlayback extends CompositeDrawable {
  @resolved(AudioManager)
  protected audioManager!: AudioManager;

  @resolved(EditorMixer)
  protected mixer!: EditorMixer;

  get channel() {
    return this.mixer.music;
  }

  playAudio(url: string) {
    if (url === this.#url) {
      return;
    }

    if (this.#audio)
      this.stop(true);

    this.#url = url;

    const audio = this.#audio = new Audio(url);
    audio.loop = true;
    audio.currentTime = 10;
    audio.crossOrigin = 'anonymous';
    audio.autoplay = true;
    audio.volume = 0;

    gsap.to(audio, {
      volume: 1,
      duration: 0.25,
    });

    const source = this.#source = this.audioManager.context.createMediaElementSource(audio);
    source.connect(this.channel.input);
  }

  pause(fadeOut = false): Promise<void> {
    if (!this.#audio)
      return Promise.resolve();

    if (fadeOut) {
      const audio = this.#audio;

      return new Promise((resolve) => {
        gsap.to(this.#audio, {
          volume: 0,
          duration: 0.25,
          onComplete: () => {
            audio.pause();
            resolve();
          },
        });
      });
    }

    this.#audio.pause();

    return Promise.resolve();
  }

  resume() {
    if (!this.#audio)
      return;

    try {
      this.#audio.play();
      this.#audio.volume = 1;
    }
    catch (e) {
      console.error('Failed to resume playback', e);
    }
  }

  stop(fadeOut = false): Promise<void> {
    const audio = this.#audio;
    const source = this.#source;

    if (!audio || !source) {
      return Promise.resolve();
    }

    const promise = this.pause(fadeOut);

    this.#audio = null;
    this.#source = null;
    this.#url = null;

    return promise.then(() => {
      audio.remove();
      source.disconnect();
    });
  }

  #url: string | null = null;

  #audio: HTMLAudioElement | null = null;

  #source: MediaElementAudioSourceNode | null = null;
}
