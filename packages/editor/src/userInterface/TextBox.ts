import type { ClickEvent, IKeyBindingHandler, KeyBindingPressEvent } from 'osucad-framework';
import { Action, Anchor, Axes, BindableWithCurrent, Cached, CompositeDrawable, Container, EasingFunction, MouseButton, PlatformAction, TextInputSource, clamp, dependencyLoader, resolved } from 'osucad-framework';

import { BitmapFontManager } from 'pixi.js';
import gsap from 'gsap';
import { FastRoundedBox } from '../drawables/FastRoundedBox';
import { OsucadSpriteText } from '../OsucadSpriteText';
import { ThemeColors } from '../editor/ThemeColors';
import { animate } from '../utils/animate';

export class TextBox extends Container implements IKeyBindingHandler<PlatformAction> {
  constructor() {
    super({
      relativeSizeAxes: Axes.X,
      height: 30,
    });
  }

  readonly isKeyBindingHandler = true;

  canHandleKeyBinding(binding: PlatformAction): boolean {
    return binding instanceof PlatformAction;
  }

  onKeyBindingPressed(e: KeyBindingPressEvent<PlatformAction>): boolean {
    switch (e.pressed) {
      case PlatformAction.MoveForwardChar:
        this.#moveCursor(1, false);
        return true;
      case PlatformAction.MoveBackwardChar:
        this.#moveCursor(-1, false);
        return true;
      case PlatformAction.MoveForwardWord:
        this.#moveCursor(1, true);
        return true;
      case PlatformAction.MoveBackwardWord:
        this.#moveCursor(-1, true);
        return true;
      case PlatformAction.DeleteForwardChar:
        this.#deleteForwardChar();
        return true;
      case PlatformAction.SelectForwardChar:
        this.#selectForwardChar();
        return true;
      case PlatformAction.SelectBackwardChar:
        this.#selectBackwardChar();
        return true;

      case PlatformAction.DeleteBackwardChar:
        this.#deleteBackwardChar();
        return true;
      case PlatformAction.DeleteForwardWord:
        this.#deleteForwardWord();
        return true;
      case PlatformAction.DeleteBackwardWord:
        this.#deleteBackwardWord();
        return true;
      case PlatformAction.SelectAll:
        this.#selectAll();
    }

    return false;
  }

  @dependencyLoader()
  [Symbol('load')]() {
    this.addAllInternal(
      new FastRoundedBox({
        relativeSizeAxes: Axes.Both,
        color: 0x000000,
        alpha: 0.4,
        cornerRadius: 4,
      }),
      this.#textContainer = new Container({
        relativeSizeAxes: Axes.Both,
        padding: { horizontal: 8, vertical: 7 },
        children: [
          this.#placeholder = this.createPlaceholder().with({
            anchor: Anchor.CenterLeft,
            origin: Anchor.CenterLeft,
            x: 2,
          }),
          this.#caret = new Caret().with({
            anchor: Anchor.CenterLeft,
            origin: Anchor.CenterLeft,
          }),
          this.#spriteText = this.createText().with({
            anchor: Anchor.CenterLeft,
            origin: Anchor.CenterLeft,
          }),
        ],
      }),
    );
  }

  #textContainer!: Container;

  #placeholder!: OsucadSpriteText;

  #caret!: Caret;

  #spriteText!: OsucadSpriteText;

  #textAndLayout = new Cached();

  @resolved(ThemeColors)
  colors!: ThemeColors;

  createPlaceholder(): OsucadSpriteText {
    return new OsucadSpriteText({
      text: 'Search',
      color: this.colors.text,
      alpha: 0.5,
    });
  }

  createText(): OsucadSpriteText {
    return new OsucadSpriteText({
      color: this.colors.text,
    });
  }

  protected getPositionAt(position: number) {
    position = clamp(position, 0, this.text.length);

    const text = this.text.slice(0, position);

    if (text.length === 0) {
      return 0;
    }

    const whiteSpaceWidth = 4.1;

    if (text.trim().length === 0)
      return text.length * whiteSpaceWidth;

    const measurement = BitmapFontManager.measureText(text, this.#spriteText.style);

    const trailingWhitespaceCount = text.length - text.trimEnd().length;

    return measurement.width * measurement.scale + trailingWhitespaceCount * whiteSpaceWidth;
  }

  cursor = new TextCursor();

  updateAfterChildren() {
    super.updateAfterChildren();

    if (!this.cursor.isValid || !this.#textAndLayout.isValid) {
      this.cursor.validate();
      this.#textAndLayout.validate();

      this.#updateCaret();

      this.#spriteText.text = this.text;

      if (this.#text.length === 0)
        this.#placeholder.show();
      else
        this.#placeholder.hide();
    }
  }

  #updateCaret() {
    if (!this.hasFocus) {
      this.#caret.hide();
      return;
    }

    this.#caret.show();

    const position = this.getPositionAt(this.cursor.rangeLeft);

    if (this.cursor.isRange) {
      const positionEnd = this.getPositionAt(this.cursor.rangeRight);

      this.#caret.setPosition(position, positionEnd - position);
    }
    else {
      this.#caret.setPosition(position);
    }
  }

  @resolved(TextInputSource)
  protected textInput!: TextInputSource;

  protected startAcceptingInput() {
    console.log('startAcceptingInput');
    this.textInput.activate();
    this.textInput.onTextInput.addListener(this.#onTextInput);
  }

  protected endAcceptingInput() {
    console.log('endAcceptingInput');
    this.textInput.deactivate();
    this.textInput.onTextInput.removeListener(this.#onTextInput);
  }

  onFocus() {
    this.startAcceptingInput();

    return true;
  }

  onFocusLost(): boolean {
    this.endAcceptingInput();

    return true;
  }

  #onTextInput = (text: string) => {
    this.insertTextAtCursor(text);
  };

  #current = new BindableWithCurrent<string>('');

  get current() {
    return this.#current.current;
  }

  set current(value) {
    this.#current.current = value;
  }

  #text = '';

  get text() {
    return this.#text;
  }

  set text(value) {
    if (this.current.disabled)
      return;

    if (this.#text === value)
      return;

    this.#text = value;
    this.#textAndLayout.invalidate();
  }

  protected insertTextAtCursor(text: string) {
    this.text = this.text.slice(0, this.cursor.rangeLeft) + text + this.text.slice(this.cursor.rangeRight);
    this.cursor.moveTo(this.cursor.rangeLeft + text.length);
  }

  #getStartOfWordForward(text: string, position: number) {
    while (position < text.length && text[position] !== ' ') {
      position++;
    }

    while (position < text.length && text[position] === ' ') {
      position++;
    }

    return position;
  }

  #getStartOfWordBackward(text: string, position: number) {
    while (position > 0 && text[position - 1] === ' ') {
      position--;
    }

    while (position > 0 && text[position - 1] !== ' ') {
      position--;
    }

    return position;
  }

  #moveCursor(direction: number, word: boolean) {
    direction = Math.sign(direction);
    let position = direction === -1 ? this.cursor.rangeLeft : this.cursor.rangeRight;

    if (word) {
      if (direction > 0)
        position = this.#getStartOfWordForward(this.text, position);
      else
        position = this.#getStartOfWordBackward(this.text, position);

      this.cursor.moveTo(clamp(position, 0, this.text.length));
    }
    else if (this.cursor.isRange) {
      this.cursor.moveTo(position);
    }
    else {
      this.cursor.moveTo(clamp(position + direction, 0, this.text.length));
    }
  }

  #deleteRange(start: number, end: number) {
    const text = this.text;
    this.text = text.slice(0, start) + text.slice(end);
    this.cursor.moveTo(start);
  }

  #deleteSelection() {
    this.#deleteRange(this.cursor.rangeLeft, this.cursor.rangeRight);
  }

  #deleteForwardChar() {
    if (this.cursor.isRange) {
      this.#deleteSelection();
      return;
    }

    this.#deleteRange(this.cursor.rangeLeft, this.cursor.rangeLeft + 1);
  }

  #deleteBackwardChar() {
    if (this.cursor.isRange) {
      this.#deleteSelection();
      return;
    }

    this.text = this.text.slice(0, this.cursor.rangeLeft - 1) + this.text.slice(this.cursor.rangeLeft);
    this.cursor.moveTo(this.cursor.rangeLeft - 1);
  }

  #deleteForwardWord() {
    const text = this.text;
    const start = this.cursor.rangeLeft;
    let end = start;

    while (end < text.length && text[end] === ' ') {
      end++;
    }

    while (end < text.length && text[end] !== ' ') {
      end++;
    }

    this.#deleteRange(start, end);
  }

  #deleteBackwardWord() {
    if (this.cursor.isRange) {
      this.#deleteRange(this.cursor.rangeLeft, this.cursor.rangeRight);
      return;
    }

    const text = this.text;
    let start = this.cursor.rangeLeft;
    const end = start;

    while (start > 0 && text[start - 1] === ' ') {
      start--;
    }

    while (start > 0 && text[start - 1] !== ' ') {
      start--;
    }

    this.#deleteRange(start, end);
  }

  #selectAll() {
    this.cursor.setRange(0, this.text.length);
  }

  #selectForwardChar() {
    this.cursor.end = Math.min(this.cursor.end + 1, this.text.length);
  }

  #selectBackwardChar() {
    this.cursor.end = Math.max(this.cursor.end - 1, 0);
  }

  get acceptsFocus(): boolean {
    return true;
  }

  onClick(e: ClickEvent): boolean {
    return e.button === MouseButton.Left;
  }
}

class Caret extends CompositeDrawable {
  constructor() {
    super();

    this.relativeSizeAxes = Axes.Y;
    this.width = 2;
  }

  @resolved(ThemeColors)
  colors!: ThemeColors;

  #caret!: FastRoundedBox;

  @dependencyLoader()
  load() {
    this.addInternal(this.#caret = new FastRoundedBox({
      relativeSizeAxes: Axes.Both,
      color: this.colors.text,
      cornerRadius: 0.5,
    }));
  }

  isRange = false;

  setPosition(position: number, width = 0) {
    this.isRange = width > 0;

    if (this.isRange) {
      this.moveToX(position, 100, EasingFunction.OutExpo);
      this.fadeTo(0.4);
      this.#caret.alpha = 1;
      gsap.to(this, {
        width,
        duration: 0.1,
        ease: 'expo.out',
      });
    }
    else {
      this.moveToX(position - 1, 100, EasingFunction.OutExpo);
      this.fadeIn(100);
      gsap.to(this, {
        width: 2,
        duration: 0.1,
        ease: 'expo.out',
      });
    }
  }

  flashDuration = 750;

  flashInRatio = 0.125;

  update() {
    super.update();

    if (!this.isRange) {
      const time = (this.time.current % this.flashDuration) / this.flashDuration;

      if (time < this.flashInRatio) {
        this.#caret.alpha = animate(time, 0, this.flashInRatio, 0.75, 1);
      }
      else {
        this.#caret.alpha = animate(time, this.flashInRatio, 1, 1, 0.5);
      }
    }
    else {
      this.#caret.alpha = 0.4;
    }
  }
}

class TextCursor {
  #start = 0;
  #end = 0;

  isValid = true;

  invalidate() {
    this.isValid = false;
  }

  validate() {
    this.isValid = true;
  }

  get end() {
    return this.#end;
  }

  set end(value) {
    this.#end = value;
    this.invalidate();
  }

  get start() {
    return this.#start;
  }

  set start(value) {
    this.#start = value;
    this.invalidate();
  }

  get isRange() {
    return this.start !== this.end;
  }

  get rangeLeft() {
    return Math.min(this.start, this.end);
  }

  get rangeRight() {
    return Math.max(this.start, this.end);
  }

  moveTo(position: number) {
    if (position < 0)
      position = 0;

    this.start = position;
    this.end = position;

    this.invalidate();
  }

  setRange(start: number, end: number) {
    this.start = start;
    this.end = end;

    this.invalidate();
  }

  onUpdate = new Action();
}