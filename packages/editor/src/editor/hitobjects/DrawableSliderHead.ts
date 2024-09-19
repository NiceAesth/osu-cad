import { OsuSkinComponentLookup } from '../../skinning/OsuSkinComponentLookup.ts';
import { DrawableHitCircle } from './DrawableHitCircle.ts';

export class DrawableSliderHead extends DrawableHitCircle {
  constructor() {
    super();
  }

  override get circlePieceComponent() {
    return OsuSkinComponentLookup.SliderHeadHitCircle;
  }

  override updatePosition() {}

  onApplied() {
    super.onApplied();

    // debugger
  }
}
