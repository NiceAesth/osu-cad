import type { Action, AudioChannel, Drawable, Sample } from 'osucad-framework';
import type { Texture } from 'pixi.js';
import type { ISkin } from './ISkin';
import type { ISkinComponentLookup } from './ISkinComponentLookup';
import type { ISkinSource } from './ISkinSource';

export class SkinSource implements ISkinSource {
  constructor(...skins: ISkin[]) {
    this.#skins = skins;
    this.#skin = skins[0];
  }

  readonly #skins: ISkin[];

  get skin() {
    return this.#skin;
  }

  set skin(value: ISkin) {
    if (this.#skin === value)
      return;

    this.#skin = value;
    this.#skins[0] = value;
    this.sourceChanged.emit();
  }

  #skin: ISkin;

  readonly sourceChanged = new Action();

  findProvider(lookupFunction: (skin: ISkin) => boolean): ISkin | null {
    return this.allSources.find(lookupFunction) ?? null;
  }

  get allSources(): ISkin[] {
    return this.#skins;
  }

  getDrawableComponent(lookup: ISkinComponentLookup): Drawable | null {
    return this.skin.getDrawableComponent(lookup);
  }

  getTexture(componentName: string): Texture | null {
    for (const source of this.allSources) {
      const texture = source.getTexture(componentName);
      if (texture)
        return texture;
    }

    return null;
  }

  async getSample(channel: AudioChannel, name: string): Promise<Sample | null> {
    for (const source of this.allSources) {
      const sample = source.getSample(channel, name);
      if (sample)
        return sample;
    }

    return null;
  }
}
