import { CommandHandler } from './CommandHandler';
import { IEditorCommand } from './IEditorCommand';

const commandHandlers: Record<string, CommandHandler<any>> = {};

export function registerCommand(handler: CommandHandler<any>) {
  if (commandHandlers[handler.command]) {
    console.warn(`Command handler for '${handler.command}' already registered`);
  }

  commandHandlers[handler.command] = handler;

  console.debug(`Registered command handler for '${handler.command}'`);
}

export function getCommandHandler<T extends IEditorCommand>(
  command: T,
): CommandHandler<T> | null {
  return commandHandlers[command.type] as CommandHandler<T> | null;
}
