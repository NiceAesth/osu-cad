import {
  Beatmap,
  CommandContext,
  IEditorCommand,
  getCommandHandler,
} from '@osucad/common';
import { EditorContext } from './EditorContext';
import { Bindable } from 'osucad-framework';

export class CommandManager {
  constructor(
    readonly editorContext: EditorContext,
    readonly beatmap: Beatmap,
  ) {}

  readonly canUndo = new Bindable(false);

  readonly canRedo = new Bindable(false);

  createContext(): CommandContext {
    return new CommandContext(this.beatmap, true);
  }

  #context: CommandContext | null = null;

  protected get context(): CommandContext {
    if (!this.#context) {
      this.#context = this.createContext();
    }

    return this.#context;
  }

  undo(): boolean {
    return this.#undo();
  }

  redo(): boolean {
    return this.#redo();
  }

  protected beforeCommandSubmit(command: IEditorCommand): boolean {
    return true;
  }

  protected afterCommandSubmit(command: IEditorCommand) {}

  #commandVersion = 0;

  submit(command: IEditorCommand, commit = true) {
    this.#submit(command, true);

    if (commit) {
      this.commit();
    }
  }

  commit() {
    this.#commit();
    this.#updateCanUndoRedo();
  }

  #submit(command: IEditorCommand, recordHistory = true) {
    command.version = this.#commandVersion++;
    if (!this.beforeCommandSubmit(command)) return;

    this.#record(command);

    if (this.#handle(command)) {
      this.afterCommandSubmit(command);
    }
  }

  #handle(command: IEditorCommand): boolean {
    const handler = getCommandHandler(command);

    if (!handler) {
      console.error(`No handler found for command ${command.type}`);
      return false;
    }

    if (handler.canBeIgnored(this.context, command)) return false;

    handler.apply(this.context, command, 'local');
    return true;
  }

  #transaction: HistoryEntry[] = [];

  #record(command: IEditorCommand) {
    const handler = getCommandHandler(command);
    if (!handler) return;

    let reverse = handler.createUndoCommand(this.context, command);

    for (let i = this.#transaction.length - 1; i >= 0; i--) {
      const entry = this.#transaction[i];
      if (entry.command.type !== command.type) continue;

      const merged = handler.merge(this.context, entry.command, command);
      if (merged) {
        this.#transaction.splice(i, 1);
        i--;

        command = merged;

        if (reverse && entry.reverse) {
          reverse =
            handler.merge(this.context, reverse, entry.reverse) ?? reverse;
        }
      }
    }

    this.#transaction.push({ command, reverse });
  }

  #undoStack: HistoryEntry[][] = [];
  #redoStack: HistoryEntry[][] = [];

  #undo(): boolean {
    if (this.#undoStack.length === 0) return false;
    const transaction = this.#undoStack.pop()!;

    const redoTransaction: HistoryEntry[] = [];

    for (let i = transaction.length - 1; i >= 0; i--) {
      const { reverse: command } = transaction[i];
      if (command) {
        const reverse = getCommandHandler(command)?.createUndoCommand(
          this.context,
          command,
        );
        this.#submit(command, false);
        if (reverse) redoTransaction.push({ command, reverse });
      }
    }

    if (redoTransaction.length > 0) {
      this.#redoStack.push(redoTransaction);
    }

    this.#updateCanUndoRedo();

    return true;
  }

  #redo(): boolean {
    if (this.#redoStack.length === 0) return false;
    const transaction = this.#redoStack.pop()!;

    const undoTransaction: HistoryEntry[] = [];

    for (let i = transaction.length - 1; i >= 0; i--) {
      const { command, reverse } = transaction[i];
      if (reverse) {
        this.#submit(reverse, false);
        undoTransaction.push({ command: reverse, reverse: command });
      }
    }

    if (undoTransaction.length > 0) {
      this.#undoStack.push(undoTransaction);
    }

    this.#updateCanUndoRedo();

    return true;
  }

  #commit() {
    if (this.#transaction.length === 0) {
      return false;
    }

    this.#undoStack.push(this.#transaction);
    this.#transaction = [];

    this.#redoStack.length = 0;

    return true;
  }

  #updateCanUndoRedo() {
    this.canUndo.value = this.#undoStack.length > 0;
    this.canRedo.value = this.#redoStack.length > 0;
  }
}

interface HistoryEntry {
  command: IEditorCommand;
  reverse: IEditorCommand | null;
}
