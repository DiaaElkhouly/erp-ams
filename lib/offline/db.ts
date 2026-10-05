import Dexie, { Table } from "dexie";

export interface OutboxItem {
  id: string;
  url: string;
  method: string;
  body: any;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
  status: "pending" | "failed" | "retrying";
}

export interface ConflictRecord {
  id: string;
  entity: string;
  entityId: string;
  conflictData: any;
  resolved: boolean;
  createdAt: number;
}

export interface MetaRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export class OfflineDB extends Dexie {
  outbox!: Table<OutboxItem, string>;
  conflicts!: Table<ConflictRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("ims-offline-db");
    this.version(1).stores({
      outbox: "id, url, method, idempotencyKey, createdAt, status",
      conflicts: "id, entity, entityId, createdAt, resolved",
      meta: "key, updatedAt",
    });
  }
}

export const offlineDb = new OfflineDB();
