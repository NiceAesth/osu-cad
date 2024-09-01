import {
  Anchor,
  CompositeDrawable,
  DrawableSprite,
  EasingFunction,
  dependencyLoader,
  resolved,
} from 'osucad-framework';
import { Skin } from '../../skins/Skin';
import type { Slider } from '../../beatmap/hitObjects/Slider';
import { SliderTick } from '../../beatmap/hitObjects/SliderTick';
import { SliderRepeat } from '../../beatmap/hitObjects/SliderRepeat';
import { DrawableHitObject } from './DrawableHitObject';

export class DrawableFollowCircle extends CompositeDrawable {
  @resolved(Skin)
  skin!: Skin;

  #followCircle!: DrawableSprite;

  @resolved(DrawableHitObject)
  drawableHitObject!: DrawableHitObject;

  @dependencyLoader()
  load() {
    this.addAllInternal(
      (this.#followCircle = new DrawableSprite({
        texture: this.skin.sliderFollowCircle,
        anchor: Anchor.Center,
        origin: Anchor.Center,
        scale: 0.5,
      })),
    );
  }

  protected loadComplete() {
    super.loadComplete();

    this.drawableHitObject.hitObjectApplied.addListener(this.#onHitObjectApplied, this);
    this.#onHitObjectApplied(this.drawableHitObject);
  }

  #onHitObjectApplied(parentObject: DrawableHitObject) {
    const hitObject = parentObject!.hitObject as Slider;

    const remainingTime = hitObject.endTime - hitObject.startTime;

    this.applyTransformsAt(Number.MIN_VALUE);
    this.clearTransformsAfter(Number.MIN_VALUE);

    {
      using _ = this.beginAbsoluteSequence(hitObject.startTime);
      this
        .scaleTo(1).scaleTo(2, Math.min(180, remainingTime), EasingFunction.Out)
        .fadeTo(0).fadeTo(1, Math.min(60, remainingTime));
    }

    for (const nested of hitObject.nestedHitObjects) {
      if (nested instanceof SliderTick || nested instanceof SliderRepeat) {
        using _ = this.beginAbsoluteSequence(nested.startTime);
        this.scaleTo(2.2).scaleTo(2, 200);
      }
    }

    {
      using _ = this.beginAbsoluteSequence(hitObject.endTime);
      this.scaleTo(1.6, 200, EasingFunction.Out)
        .fadeOut(200, EasingFunction.In);
    }
  }
}