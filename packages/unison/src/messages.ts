import { IClient } from "./interfaces";

export interface ISignalRequest {
  name: string;
  content: unknown;
}

export interface ISignalMessage {
  clientId: number;
  name: string;
  timestamp: number;
  content: unknown;
}

export interface IDocumentMessage {
  path: string;
  content: unknown;
  clientMetadata?: any;
  serverMetadata?: any;
}

export interface IProcesessedDocumentMessage extends IDocumentMessage {
  clientId: number;
}
