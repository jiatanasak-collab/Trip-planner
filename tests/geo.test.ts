import { describe, expect, it } from "vitest";
import { cleanLL, parseLL } from "../src/domain/geo";

describe("parseLL", () => {
  it("พิกัดตรงๆ", () => {
    expect(parseLL("35.7148, 139.7967")).toEqual({ lat: 35.7148, lng: 139.7967 });
    expect(parseLL("-33.8568,151.2153")).toEqual({ lat: -33.8568, lng: 151.2153 });
  });
  it("ลิงก์ Google Maps แบบต่างๆ", () => {
    expect(parseLL("https://www.google.com/maps/place/X/@35.6938,139.7034,17z")).toEqual({ lat: 35.6938, lng: 139.7034 });
    expect(parseLL("https://maps.google.com/?q=13.7563,100.5018")).toEqual({ lat: 13.7563, lng: 100.5018 });
    expect(parseLL("https://www.google.com/maps/search/?api=1&query=13.7563%2C100.5018")).toEqual({ lat: 13.7563, lng: 100.5018 });
    expect(parseLL("https://www.google.com/maps/place/X/data=!3d35.71!4d139.79")).toEqual({ lat: 35.71, lng: 139.79 });
  });
  it("ไม่ใช่พิกัด", () => {
    expect(parseLL("")).toBeNull();
    expect(parseLL("Senso-ji")).toBeNull();
    expect(parseLL("https://maps.app.goo.gl/abc")).toBeNull();
    expect(parseLL("35, 139")).toBeNull();
    expect(parseLL("95.1, 10.2")).toBeNull();
  });
});

describe("cleanLL", () => {
  it("รับตัวเลขและสตริง", () => {
    expect(cleanLL({ lat: "35.1", lng: 139 })).toEqual({ lat: 35.1, lng: 139 });
  });
  it("ตัด null, 0,0 และนอกช่วง", () => {
    expect(cleanLL({ lat: null, lng: null })).toBeNull();
    expect(cleanLL({ lat: 0, lng: 0 })).toBeNull();
    expect(cleanLL({ lat: 100, lng: 0 })).toBeNull();
    expect(cleanLL({})).toBeNull();
  });
});
