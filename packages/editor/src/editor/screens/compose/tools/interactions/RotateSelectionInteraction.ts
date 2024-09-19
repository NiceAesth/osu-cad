import type {
  DragEvent,
  DragStartEvent,
  IVec2,
  KeyDownEvent,
  KeyUpEvent,
  MouseDownEvent,
  Rectangle,
} from 'osucad-framework';
import type { OsuHitObject } from '../../../../../beatmap/hitObjects/OsuHitObject';
import {
  Action,
  Anchor,
  Axes,
  Bindable,
  CompositeDrawable,
  dependencyLoader,
  EasingFunction,
  FillDirection,
  FillFlowContainer,
  Key,
  MouseButton,
  RoundedBox,
  Vec2,
} from 'osucad-framework';
import { Graphics, Matrix } from 'pixi.js';
import { Ring } from '../../../../../drawables/Ring';
import { OsucadSpriteText } from '../../../../../OsucadSpriteText';
import { DraggableDialogBox } from '../../../../../userInterface/DraggableDialogBox';
import { HitObjectComposer } from '../../HitObjectComposer';
import { HitObjectUtils } from '../../HitObjectUtils';
import { ComposeToolInteraction } from './ComposeToolInteraction';

export class RotateSelectionInteraction extends ComposeToolInteraction {
  constructor(
    readonly hitObjects: OsuHitObject[],
  ) {
    super();

    this.selectionBounds = new HitObjectUtils().getBounds(this.hitObjects);

    this.selectionCenter = this.selectionBounds.center;

    this.rotationCenter = new Bindable(this.selectionCenter);
  }

  selectionCenter: Vec2;

  selectionBounds: Rectangle;

  #hitobjectUtils = new HitObjectUtils();

  #previousTransform = new Matrix();

  rotationCenter: Bindable<Vec2>;

  #handle!: RotationHandle;

  @dependencyLoader()
  load() {
    const handle = this.#handle = new RotationHandle(
      80,
      this.selectionCenter,
    );

    this.addAllInternal(
      this.#hitobjectUtils,
      handle,
      new RotateDialogBox(this),
    );

    handle.onRotate.addListener(delta => this.setRotation(this.currentRotation.value + delta));
    handle.onRotateEnd.addListener(() => this.setRotation(this.snappedRotation));

    handle.onMove.addListener((position) => {
      handle.position = position;
      this.rotationCenter.value = position;
    });

    this.currentRotation.addOnChangeListener(() => this.#updateTransform());
    this.rotationCenter.addOnChangeListener(() => this.#updateTransform());
  }

  setRotation(value: number) {
    if (value > Math.PI * 2)
      value -= 2 * Math.PI;
    if (value < -Math.PI * 2)
      value += 2 * Math.PI;

    this.currentRotation.value = value;
  }

  currentRotation = new Bindable(0);

  snapRotation = new Bindable(false);

  get snappedRotation() {
    if (!this.snapRotation.value)
      return this.currentRotation.value;

    // 15 degrees
    const snapAngle = Math.PI / 12;

    return Math.round(this.currentRotation.value / snapAngle) * snapAngle;
  }

  #updateTransform() {
    const transform = new Matrix()
      .translate(-this.rotationCenter.value.x, -this.rotationCenter.value.y)
      .rotate(this.snappedRotation)
      .translate(this.rotationCenter.value.x, this.rotationCenter.value.y);

    this.#hitobjectUtils.transformHitObjects(
      transform.clone().append(this.#previousTransform.invert()),
      this.hitObjects,
      false,
    );

    this.#previousTransform = transform;

    this.#handle.currentRotation = this.snappedRotation;
  }

  onMouseDown(): boolean {
    this.complete();

    return false;
  }

  onKeyDown(e: KeyDownEvent): boolean {
    switch (e.key) {
      case Key.ControlLeft:
      case Key.ControlRight:
        this.snapRotation.value = true;
        return true;
      case Key.Escape:
        this.cancel();
        return true;
    }

    return false;
  }

  onKeyUp(e: KeyUpEvent): boolean {
    switch (e.key) {
      case Key.ControlLeft:
      case Key.ControlRight:
        this.snapRotation.value = false;
        return true;
    }

    return false;
  }
}

class RotationHandle extends CompositeDrawable {
  constructor(radius: number, position: IVec2) {
    super();

    this.origin = Anchor.Center;
    this.position = position;

    this.width = radius * 2;
    this.height = radius * 2;

    this.addAllInternal(
      this.#circle = new Ring({
        relativeSizeAxes: Axes.Both,
        alpha: 0.5,
        color: 0xEDD661,
        strokeWidth: 1.5,
      }),
      new RotationHandleCenter(position => this.onMove.emit(position)),
      this.#currentAngleText = new OsucadSpriteText({
        text: '0deg',
        fontSize: 11,
        position: { x: 0, y: -this.radius - 10 },
        origin: Anchor.Center,
        anchor: Anchor.Center,
      }),
    );

    this.drawNode.addChild(this.#rotationVisualizer);
  }

  get currentRotation() {
    return this.#currentRotation;
  }

  set currentRotation(value: number) {
    this.#currentRotation = value;
    this.#updateGraphics();
  }

  #rotationVisualizer = new Graphics();

  #currentRotation = 0;

  #circle: Ring;

  #currentAngleText!: OsucadSpriteText;

  get rotationCenter() {
    return this.size.scale(0.5);
  }

  receivePositionalInputAt(screenSpacePosition: Vec2): boolean {
    const local = this.toLocalSpace(screenSpacePosition).sub(this.rotationCenter);

    const distance = local.length();

    return Math.abs(distance - this.radius) < 10;
  }

  onHover(): boolean {
    this.#circle.alpha = 1;
    return true;
  }

  onHoverLost(): boolean {
    if (!this.isDragged)
      this.#circle.alpha = 0.5;
    return true;
  }

  #lastAngle = 0;

  onMouseDown(e: MouseDownEvent): boolean {
    this.#lastAngle = e.mousePosition.sub(this.rotationCenter).angle();

    this.#startAngle ??= this.#lastAngle;

    return e.button === MouseButton.Left;
  }

  onDragStart(e: DragStartEvent): boolean {
    return e.button === MouseButton.Left;
  }

  onDrag(e: DragEvent): boolean {
    const angle = e.mousePosition.sub(this.rotationCenter).angle();
    let delta = angle - this.#lastAngle;
    if (Math.abs(delta) > Math.PI) {
      delta -= Math.sign(delta) * 2 * Math.PI;
    }

    if (e.shiftPressed) {
      delta *= 0.1;
    }

    this.onRotate.emit(delta);

    this.#lastAngle = angle;

    return true;
  }

  onRotate = new Action<number>();
  onRotateEnd = new Action();

  onMove = new Action<Vec2>();

  get radius() {
    return this.width / 2;
  }

  set radius(value: number) {
    this.width = value * 2;
    this.height = value * 2;
  }

  onDragEnd(): boolean {
    if (!this.isHovered)
      this.#circle.alpha = 0.5;
    this.onRotateEnd.emit();
    return true;
  }

  #startAngle?: number;

  #updateGraphics() {
    const center = this.rotationCenter;
    const radius = this.radius;

    this.#currentAngleText.text = `${Math.round(this.#currentRotation * 180 / Math.PI)}deg`;

    this.#currentAngleText.moveTo(
      new Vec2(radius)
        .rotate(this.#currentRotation + (this.#startAngle ?? -Math.PI))
      ,
      200,
      EasingFunction.OutQuad,
    );

    const g = this.#rotationVisualizer;
    g.clear();

    if (this.#currentRotation === 0)
      return;

    g
      .moveTo(center.x, center.y)
      .arc(center.x, center.y, radius, this.#startAngle ?? -Math.PI / 2, this.#currentRotation + (this.#startAngle ?? -Math.PI / 2), this.#currentRotation < 0)
      .lineTo(center.x, center.y)
      .fill({ color: 0xE6D375, alpha: 0.5 })
    ;
  }
}

class RotationHandleCenter extends CompositeDrawable {
  constructor(
    readonly onMove: (position: Vec2) => void,
  ) {
    super();

    this.width = 12;
    this.height = 12;
    this.anchor = Anchor.Center;
    this.origin = Anchor.Center;
    this.alpha = 0.5;

    this.addInternal(new RoundedBox({
      size: 0.5,
      anchor: Anchor.Center,
      origin: Anchor.Center,
      relativeSizeAxes: Axes.Both,
      cornerRadius: 2,
    }));
  }

  onHover() {
    this.#updateState();

    return true;
  }

  onHoverLost() {
    this.#updateState();

    return true;
  }

  onMouseDown(e: MouseDownEvent): boolean {
    return e.button === MouseButton.Left;
  }

  onDragStart(): boolean {
    this.#updateState();
    return true;
  }

  onDrag(e: DragEvent): boolean {
    let position = this.findClosestParentOfType(RotateSelectionInteraction)!.toLocalSpace(e.screenSpaceMousePosition);

    const result = this.#composer.snapHitObjectPosition([position]);

    if (result.offset) {
      position = position.add(result.offset);
    }

    this.onMove(position);

    return true;
  }

  onDragEnd(): boolean {
    this.#updateState();
    return true;
  }

  #updateState() {
    if (this.isDragged || this.isHovered) {
      this.scale = 1.25;
      this.alpha = 1;
    }
    else {
      this.scale = 1;
      this.alpha = 0.5;
    }
  }

  #composer!: HitObjectComposer;

  loadComplete() {
    super.loadComplete();

    this.#composer = this.findClosestParentOfType(HitObjectComposer)!;
  }
}

class RotateDialogBox extends DraggableDialogBox {
  constructor(
    readonly interaction: RotateSelectionInteraction,
  ) {
    super();
  }

  getTitle(): string {
    return 'Rotate';
  }

  createContent() {
    return new FillFlowContainer({
      direction: FillDirection.Vertical,
    });
  }
}
