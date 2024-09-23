import { WeakList } from '../utils';
import { Action } from './Action.ts';

export type BindableListener<T> = (value: T) => void;

export class Bindable<T> implements ReadonlyBindable<T> {
  valueChanged = new Action<ValueChangedEvent<T>>();

  disabledChanged = new Action<boolean>();

  defaultChanged = new Action<ValueChangedEvent<T>>();

  #value: T;

  #defaultValue: T;

  #disabled: boolean = false;

  constructor(defaultValue: T) {
    this.#value = this.#defaultValue = defaultValue;
  }

  get disabled() {
    return this.#disabled;
  }

  set disabled(value) {
    if (this.#disabled === value)
      return;

    this.setDisabled(value);
  }

  protected setDisabled(value: boolean, bypassChecks = false, source?: Bindable<T>) {
    this.#disabled = value;
    this.triggerDisabledChange(source ?? this, true, bypassChecks);
  }

  get isDefault() {
    return this.equals(this.#value, this.#defaultValue);
  }

  setDefault() {
    this.value = this.default;
  }

  get value(): T {
    return this.#value;
  }

  set value(value: T) {
    if (this.disabled)
      throw new Error('Cannot set value on a disabled bindable');

    if (this.equals(this.#value, value))
      return;

    this.setValue(this.#value, value);
  }

  setValue(previousValue: T, value: T, bypassChecks = false, source?: Bindable<T>) {
    this.#value = value;
    this.triggerValueChange(previousValue, source ?? this, true, bypassChecks);
  }

  get default() {
    return this.#defaultValue;
  }

  set default(value: T) {
    if (this.equals(this.#defaultValue, value))
      return;

    this.setDefaultValue(this.#defaultValue, value);
  }

  protected setDefaultValue(previousValue: T, value: T, bypassChecks = false, source?: Bindable<T>) {
    this.#defaultValue = value;
    this.triggerDefaultChange(previousValue, source ?? this, true, bypassChecks);
  }

  addOnChangeListener(listener: BindableListener<ValueChangedEvent<T>>, options: AddOnChangeListenerOptions = {}) {
    this.valueChanged.addListener(listener, options.scoped);

    if (options.immediate) {
      listener({ value: this.value, previousValue: this.value });
    }
  }

  removeOnChangeListener(listener: BindableListener<ValueChangedEvent<T>>): boolean {
    return this.valueChanged.removeListener(listener);
  }

  removeAllListeners() {
    this.valueChanged.removeAllListeners();
  }

  triggerValueChange(previousValue: T, source: Bindable<T>, propagateToBindings = true, bypassChecks = false) {
    const beforePropagation = this.#value;

    if (propagateToBindings && this.bindings) {
      for (const bindable of this.bindings) {
        if (bindable === source)
          continue;

        bindable.setValue(beforePropagation, this.#value, bypassChecks, this);
      }
    }

    if (this.equals(beforePropagation, this.#value)) {
      this.valueChanged.emit({
        value: this.#value,
        previousValue,
      });
    }
  }

  triggerDefaultChange(previousValue: T, source: Bindable<T>, propagateToBindings = true, bypassChecks = false) {
    const beforePropagation = this.#defaultValue;

    if (propagateToBindings && this.bindings) {
      for (const bindable of this.bindings) {
        if (bindable === source)
          continue;

        bindable.setDefaultValue(beforePropagation, this.#defaultValue, bypassChecks, this);
      }
    }

    if (this.equals(beforePropagation, this.#defaultValue)) {
      this.defaultChanged.emit({
        value: this.#defaultValue,
        previousValue,
      });
    }
  }

  triggerDisabledChange(source: Bindable<T>, propagateToBindings = true, bypassChecks = false) {
    const beforePropagation = this.#disabled;

    if (propagateToBindings && this.bindings) {
      for (const bindable of this.bindings) {
        if (bindable === source)
          continue;

        bindable.setDisabled(this.#disabled, bypassChecks, this);
      }
    }

    if (beforePropagation === this.#disabled) {
      this.disabledChanged.emit(this.#disabled);
    }
  }

  unbindEvents() {
    this.valueChanged.removeAllListeners();
    this.disabledChanged.removeAllListeners();
    this.defaultChanged.removeAllListeners;
  }

  unbindBindings() {
    if (!this.bindings)
      return;

    for (const bindable of this.bindings) {
      this.unbindFrom(bindable);
    }
  }

  unbindAll() {
    this.unbindAllInternal();
  }

  protected unbindAllInternal() {
    // TODO: isLeased

    this.unbindEvents();
    this.unbindBindings();
  }

  unbindFrom(bindable: Bindable<T>) {
    if (!this.bindings)
      return;

    this.#removeWeakReference(bindable);
    bindable.#removeWeakReference(this);
  }

  protected bindings?: WeakList<Bindable<T>>;

  bindTo(bindable: Bindable<T>) {
    bindable.copyTo(this);

    this.#addWeakReference(bindable.weakReference);
    bindable.#addWeakReference(this.weakReference);
  }

  copyTo(bindable: Bindable<T>) {
    bindable.value = this.value;
    bindable.default = this.default;
    bindable.setDisabled(this.disabled, true);
  }

  #addWeakReference(weakReference: WeakRef<Bindable<T>>) {
    this.bindings ??= new WeakList();
    this.bindings.add(weakReference);
  }

  #removeWeakReference(bindable: Bindable<T>) {
    this.bindings?.remove(bindable);
  }

  protected equals(a: T, b: T): boolean {
    return a === b;
  }

  triggerChange() {
    this.triggerValueChange(this.#value, this, false);
    this.triggerDisabledChange(this, false);
  }

  #weakReferenceInstance?: WeakRef<this>;

  /** @internal */
  get weakReference() {
    return (this.#weakReferenceInstance ??= new WeakRef(this));
  }

  getBoundCopy(): Bindable<T> {
    const copy = this.createInstance();

    copy.bindTo(this);

    return copy;
  }

  /** @internal */
  createInstance(): Bindable<T> {
    return new Bindable(this.default);
  }
}

export interface AddOnChangeListenerOptions {
  scoped?: boolean;
  immediate?: boolean;
}

export interface ValueChangedEvent<T> {
  value: T;
  previousValue: T;
}

export interface ReadonlyBindable<T> {
  get value(): T;

  get disabled(): boolean;

  get default(): T;

  get isDefault(): boolean;

  readonly valueChanged: Action<ValueChangedEvent<T>>;

  readonly disabledChanged: Action<boolean>;

  readonly defaultChanged: Action<ValueChangedEvent<T>>;

  addOnChangeListener: (listener: BindableListener<ValueChangedEvent<T>>, options?: AddOnChangeListenerOptions) => void;

  removeOnChangeListener: (listener: BindableListener<ValueChangedEvent<T>>) => boolean;

  getBoundCopy: () => ReadonlyBindable<T>;
}