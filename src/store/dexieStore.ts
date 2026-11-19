import Dexie, { type Table } from "dexie";
import type { Journal, Trip } from "../domain/types";
import { sanitizeJournal } from "../domain/backup";
import { sanitizeTrip } from "../domain/trip";
import type { TripStore } from "./TripStore";

interface KV { key: string; value: unknown }

class TripDB extends Dexie {
  trips!: Table<Trip, string>;
  kv!: Table<KV, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ trips: "id, updated", kv: "key" });
  }
}

/** เก็บข้อมูลใน IndexedDB ของเบราว์เซอร์ (local-first) */
export class DexieTripStore implements TripStore {
  readonly label = "บันทึกในเครื่องนี้";
  private db: TripDB;
  constructor(name = "trip-planner") {
    this.db = new TripDB(name);
  }
  async listTrips() {
    const rows = await this.db.trips.toArray();
    return rows.map(sanitizeTrip);
  }
  async putTrip(trip: Trip) {
    await this.db.trips.put(JSON.parse(JSON.stringify(trip)));
  }
  async deleteTrip(id: string) {
    await this.db.trips.delete(id);
  }
  async getJournal(): Promise<Journal> {
    const row = await this.db.kv.get("journal");
    return sanitizeJournal(row?.value) || { countries: {} };
  }
  async putJournal(journal: Journal) {
    await this.db.kv.put({ key: "journal", value: JSON.parse(JSON.stringify(journal)) });
  }
}
