import type { Slider } from '@osucad/common';
import { Anchor, Container, Vec2, resolved } from 'osucad-framework';
import { animate } from '../../utils/animate';
import { PreferencesStore } from '../../preferences/PreferencesStore';
import { DrawableHitObject } from './DrawableHitObject';
import { CirclePiece } from './CirclePiece';
import { ApproachCircle } from './ApproachCircle';
import { DrawableSliderBody } from './DrawableSliderBody';
import { DrawableComboNumber } from './DrawableComboNumber';
import { DrawableSliderBall } from './DrawableSliderBall';
import { ReverseArrow } from './ReverseArrow';

export class DrawableSlider extends DrawableHitObject<Slider> {
  constructor(public slider: Slider) {
    super(slider);
    this.origin = Anchor.Center;
  }

  headCircle!: CirclePiece;
  tailCircle!: CirclePiece;
  approachCircle!: ApproachCircle;
  sliderBody!: DrawableSliderBody;
  comboNumber!: DrawableComboNumber;
  sliderBall!: DrawableSliderBall;
  reverseArrows!: Container;

  override load() {
    this.addAll(
      (this.sliderBody = new DrawableSliderBody(this.hitObject)),
      (this.tailCircle = new CirclePiece()),
      (this.reverseArrows = new Container()),
      (this.headCircle = new CirclePiece()),
      (this.approachCircle = new ApproachCircle()),
      (this.sliderBall = new DrawableSliderBall()),
    );
    this.headCircle.add(
      (this.comboNumber = new DrawableComboNumber(this.hitObject.indexInCombo)),
    );

    super.load();
  }

  setup() {
    super.setup();
    this.comboNumber.comboNumber = this.hitObject.indexInCombo;
    this.headCircle.comboColor = this.comboColor;
    this.headCircle.startTime = this.hitObject.startTime;
    this.headCircle.timePreempt = this.hitObject.timePreempt;
    this.headCircle.timeFadeIn = this.hitObject.timeFadeIn;
    this.headCircle.comboColor = this.comboColor;
    this.tailCircle.startTime = this.hitObject.endTime;
    this.tailCircle.timePreempt
      = this.hitObject.timePreempt
      + Math.min(150, this.hitObject.spanDuration / 2);
    this.tailCircle.timeFadeIn = this.hitObject.timeFadeIn;
    this.tailCircle.comboColor = this.comboColor;
    this.tailCircle.position = Vec2.scale(
      Vec2.sub(this.hitObject.endPosition, this.hitObject.position),
      1 / this.hitObject.scale,
    );

    this.reverseArrows.clear();
    for (let i = this.hitObject.repeats -1; i >= 0; i--) {
      const time = this.hitObject.startTime + this.hitObject.spanDuration * i;
      const circle = new CirclePiece();
      circle.startTime = time;
      circle.timePreempt = this.hitObject.timePreempt;
      circle.timeFadeIn = this.hitObject.timeFadeIn;
      circle.comboColor = this.comboColor;

      const angle
        = i % 2 === 0 ? this.hitObject.endAngle : this.hitObject.startAngle;

      const reverseArrow = new ReverseArrow();
      reverseArrow.rotation = angle;
      reverseArrow.startTime = time;
      reverseArrow.timePreempt = this.hitObject.timePreempt;

      this.reverseArrows.addAll(circle, reverseArrow);
      if (i % 2 === 0) {
        const position = Vec2.scale(
          this.hitObject.path.endPosition,
          1 / this.hitObject.scale,
        );
        reverseArrow.position = position;
        circle.position = position;
      }
    }

    this.sliderBody.scale = new Vec2(1 / this.hitObject.scale);
    this.sliderBody.setup();

    this.approachCircle.comboColor = this.comboColor;
    this.approachCircle.startTime = this.hitObject.startTime;
    this.approachCircle.timePreempt = this.hitObject.timePreempt;

    this.sliderBall.startTime = this.hitObject.startTime;
    this.sliderBall.endTime = this.hitObject.endTime;
  }

  @resolved(PreferencesStore)
  preferences!: PreferencesStore;

  update() {
    super.update();
    const time = this.time.current - this.hitObject.startTime;

    this.comboNumber.alpha
    = time > 0 && this.preferences.viewport.hitAnimations
        ? animate(time, 0, 50, 1, 0)
        : 1;

    if (time < 0) {
      this.sliderBody.bodyAlpha = animate(
        time,
        -this.hitObject.timePreempt,
        -this.hitObject.timePreempt + this.hitObject.timeFadeIn,
        0,
        0.8,
      );
    }
    else if (time < this.hitObject.duration) {
      this.sliderBody.bodyAlpha = 0.8;
    }
    else {
      this.sliderBody.bodyAlpha = animate(
        time,
        this.hitObject.duration,
        this.hitObject.duration + 300,
        0.8,
        0,
      );
    }

    const position = this.hitObject.positionAt(this.time.current);
    this.sliderBall.position = Vec2.scale(position, 1 / this.hitObject.scale);
  }
}
