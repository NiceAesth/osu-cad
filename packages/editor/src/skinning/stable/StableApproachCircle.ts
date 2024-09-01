import type { Bindable } from 'osucad-framework';
import { DrawableSprite, Vec2, dependencyLoader, resolved } from 'osucad-framework';
import type { ColorSource } from 'pixi.js';
import { ISkinSource } from '../ISkinSource';
import { DrawableHitObject } from '../../editor/hitobjects/DrawableHitObject';

export class StableApproachCircle extends DrawableSprite {
  constructor() {
    super({
      // relativeSizeAxes: Axes.Both,
    });
  }

  @resolved(ISkinSource)
  private skin!: ISkinSource;

  private accentColor!: Bindable<ColorSource>;

  @resolved(DrawableHitObject)
  private drawableHitObject!: DrawableHitObject;

  @dependencyLoader()
  load() {
    const texture = this.skin.getTexture('approachcircle');
    if (texture) {
      this.texture = texture;
      this.size = new Vec2(texture.width, texture.height);
    }
  }

  protected loadComplete() {
    super.loadComplete();

    this.accentColor = this.drawableHitObject.accentColor.getBoundCopy();
    this.accentColor.addOnChangeListener(color => this.color = color.value, { immediate: true });
  }
}