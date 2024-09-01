import { GameplaySkinComponentLookup } from './GameplaySkinComponentLookup';
import { OsuSkinComponents } from './OsuSkinComponents';

export class OsuSkinComponentLookup extends GameplaySkinComponentLookup<OsuSkinComponents> {
  static HitCircle = new OsuSkinComponentLookup(OsuSkinComponents.HitCircle);
  static ApproachCircle = new OsuSkinComponentLookup(OsuSkinComponents.ApproachCircle);
  static SliderHeadHitCircle = new OsuSkinComponentLookup(OsuSkinComponents.SliderHeadHitCircle);
  static SliderTailHitCircle = new OsuSkinComponentLookup(OsuSkinComponents.SliderTailHitCircle);
  static SliderScorePoint = new OsuSkinComponentLookup(OsuSkinComponents.SliderScorePoint);
  static SliderFollowCircle = new OsuSkinComponentLookup(OsuSkinComponents.SliderFollowCircle);
  static ReverseArrow = new OsuSkinComponentLookup(OsuSkinComponents.ReverseArrow);
  static SliderBall = new OsuSkinComponentLookup(OsuSkinComponents.SliderBall);
  static FollowPoint = new OsuSkinComponentLookup(OsuSkinComponents.FollowPoint);
  static SpinnerBody = new OsuSkinComponentLookup(OsuSkinComponents.SpinnerBody);
}
