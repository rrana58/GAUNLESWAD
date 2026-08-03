jest.mock("https");
const https = require("https");

const { reverseGeocode, validateDeliveryAddress, isWithinNepal } = require("../../../utils/geocode");

// Helper to mock https.get to resolve with a given JSON body
const mockHttpsGetSuccess = (jsonBody) => {
  https.get.mockImplementation((url, options, callback) => {
    const res = {
      on: (event, handler) => {
        if (event === "data") handler(JSON.stringify(jsonBody));
        if (event === "end") handler();
        return res;
      },
    };
    callback(res);
    return { on: () => {} };
  });
};

const mockHttpsGetNetworkError = (err) => {
  https.get.mockImplementation(() => {
    return { on: (event, handler) => { if (event === "error") handler(err); } };
  });
};

const mockHttpsGetInvalidJson = () => {
  https.get.mockImplementation((url, options, callback) => {
    const res = {
      on: (event, handler) => {
        if (event === "data") handler("not json{{{");
        if (event === "end") handler();
        return res;
      },
    };
    callback(res);
    return { on: () => {} };
  });
};

describe("isWithinNepal", () => {
  test("returns true for Kathmandu coordinates", () => {
    expect(isWithinNepal(27.7172, 85.324)).toBe(true);
  });

  test("returns false for coordinates outside Nepal (e.g. Delhi)", () => {
    expect(isWithinNepal(28.6139, 77.209)).toBe(false);
  });

  test("returns true exactly on the boundary (minLat/minLng)", () => {
    expect(isWithinNepal(26.347, 80.058)).toBe(true);
  });

  test("returns true exactly on the boundary (maxLat/maxLng)", () => {
    expect(isWithinNepal(30.448, 88.201)).toBe(true);
  });

  test("returns false just outside the boundary", () => {
    expect(isWithinNepal(26.346, 85)).toBe(false);
    expect(isWithinNepal(30.449, 85)).toBe(false);
    expect(isWithinNepal(28, 80.057)).toBe(false);
    expect(isWithinNepal(28, 88.202)).toBe(false);
  });
});

describe("validateDeliveryAddress", () => {
  test("rejects null/undefined address", () => {
    expect(validateDeliveryAddress(null).valid).toBe(false);
    expect(validateDeliveryAddress(undefined).valid).toBe(false);
  });

  test("rejects non-object address", () => {
    expect(validateDeliveryAddress("street").valid).toBe(false);
  });

  describe("type=gps", () => {
    test("requires coordinates", () => {
      const result = validateDeliveryAddress({ type: "gps" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("coordinates are required for GPS location");
    });

    test("rejects non-numeric coordinates", () => {
      const result = validateDeliveryAddress({ type: "gps", coordinates: { lat: "abc", lng: "xyz" } });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/valid numbers/);
    });

    test("rejects coordinates outside Nepal", () => {
      const result = validateDeliveryAddress({ type: "gps", coordinates: { lat: 28.6139, lng: 77.209 } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Coordinates must be within Nepal");
    });

    test("accepts valid Nepal GPS coordinates", () => {
      const result = validateDeliveryAddress({ type: "gps", coordinates: { lat: 27.7, lng: 85.3 } });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("type=manual (default)", () => {
    test("requires a non-empty street", () => {
      const result = validateDeliveryAddress({ street: "" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("street address is required");
    });

    test("requires street when whitespace only", () => {
      const result = validateDeliveryAddress({ street: "   " });
      expect(result.valid).toBe(false);
    });

    test("rejects street longer than 200 chars", () => {
      const result = validateDeliveryAddress({ street: "a".repeat(201) });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("street address max 200 chars");
    });

    test("accepts a valid street with no coordinates", () => {
      const result = validateDeliveryAddress({ street: "Thamel Marg" });
      expect(result.valid).toBe(true);
    });

    test("rejects manual address whose provided coordinates fall outside Nepal", () => {
      const result = validateDeliveryAddress({
        street: "Some street",
        coordinates: { lat: 40.7128, lng: -74.006 }, // New York
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("provided coordinates are not within Nepal");
    });

    test("accepts manual address with coordinates within Nepal", () => {
      const result = validateDeliveryAddress({
        street: "Some street",
        coordinates: { lat: 27.7, lng: 85.3 },
      });
      expect(result.valid).toBe(true);
    });

    test("ignores non-numeric coordinates on manual address (does not error)", () => {
      const result = validateDeliveryAddress({
        street: "Some street",
        coordinates: { lat: "n/a", lng: "n/a" },
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe("reverseGeocode", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns parsed address fields on a successful Nominatim response", async () => {
    mockHttpsGetSuccess({
      address: {
        road: "Durbar Marg",
        house_number: "12",
        suburb: "Kathmandu",
        city: "Kathmandu",
        amenity: "Narayanhiti Palace",
      },
      display_name: "Durbar Marg, Kathmandu, Nepal",
    });

    const result = await reverseGeocode(27.7, 85.3);
    expect(result.street).toBe("12, Durbar Marg");
    expect(result.area).toBe("Kathmandu");
    expect(result.city).toBe("Kathmandu");
    expect(result.landmark).toBe("Narayanhiti Palace");
    expect(result.displayName).toBe("Durbar Marg, Kathmandu, Nepal");
  });

  test("falls back to coordinate string when address fields are missing", async () => {
    mockHttpsGetSuccess({ address: {} });
    const result = await reverseGeocode(27.7, 85.3);
    expect(result.street).toBe("27.700000, 85.300000");
    expect(result.city).toBe("Kathmandu");
  });

  test("returns fallback object when the geocoder responds with an error field", async () => {
    mockHttpsGetSuccess({ error: "Unable to geocode" });
    const result = await reverseGeocode(27.7, 85.3);
    expect(result.city).toBe("Kathmandu");
    expect(result.street).toBe("27.700000, 85.300000");
  });

  test("never throws on a network error — resolves with fallback", async () => {
    mockHttpsGetNetworkError(new Error("network down"));
    await expect(reverseGeocode(27.7, 85.3)).resolves.toEqual(
      expect.objectContaining({ city: "Kathmandu" })
    );
  });

  test("never throws on invalid JSON response — resolves with fallback", async () => {
    mockHttpsGetInvalidJson();
    await expect(reverseGeocode(27.7, 85.3)).resolves.toEqual(
      expect.objectContaining({ city: "Kathmandu" })
    );
  });
});
