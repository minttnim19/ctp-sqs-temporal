const mockExecute = jest.fn();
const mockGet = jest.fn(() => ({ execute: mockExecute }));
const mockPost = jest.fn(() => ({ execute: mockExecute }));
const mockWithKey = jest.fn(() => ({ get: mockGet }));
const mockWithId = jest.fn(() => ({ post: mockPost, get: mockGet }));
const mockChannels = jest.fn(() => ({ get: mockGet, post: mockPost, withKey: mockWithKey }));
const mockInventory = jest.fn(() => ({
  get: mockGet,
  post: mockPost,
  withId: mockWithId,
}));
const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
    isNotFound: jest.fn(),
    isCTHttpError: jest.fn(),
  },
}));

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";
import {
  CommercetoolsChannelClient,
  mapCustomFields,
  buildCustomUpdateActions,
  buildQuantityUpdateAction,
  type PrebookCustom,
} from "@/infra/adapters/ctp-channel-client";

const baseCustom: PrebookCustom = {
  campaignType: "normal",
  brand: "BrandX",
  matCode: "SKU001",
  displayName: "Product 1",
  quota: 100,
  serviceCode: "SVC001",
  depositAmount: 500,
  channel: "WW",
  bookingStart: "2024-01-01T00:00:00.000Z",
  bookingEnd: "2024-01-31T00:00:00.000Z",
  pickupStart: "2024-02-01T00:00:00.000Z",
  pickupMessage: "Pickup note",
  bookingProductGroup: "BPG1",
};

describe("CommercetoolsChannelClient", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockGet.mockReset().mockReturnValue({ execute: mockExecute });
    mockPost.mockReset().mockReturnValue({ execute: mockExecute });
    mockWithKey.mockReset().mockReturnValue({ get: mockGet });
    mockWithId.mockReset().mockReturnValue({ post: mockPost, get: mockGet });
    mockChannels
      .mockReset()
      .mockReturnValue({ get: mockGet, post: mockPost, withKey: mockWithKey });
    mockInventory.mockReset().mockReturnValue({ get: mockGet, post: mockPost, withId: mockWithId });
    getInstanceMock.mockReturnValue({
      apiRoot: {
        channels: mockChannels,
        inventory: mockInventory,
      },
    });
    (CommerceToolsClient.isNotFound as jest.Mock).mockReset();
  });

  describe("getChannelByKey", () => {
    it("returns channel when found", async () => {
      const channel = { id: "ch1", key: "CH_KEY" };
      mockExecute.mockResolvedValue({ body: channel });

      const client = new CommercetoolsChannelClient();
      const result = await client.getChannelByKey("CH_KEY");

      expect(result).toEqual(channel);
      expect(mockWithKey).toHaveBeenCalledWith({ key: "CH_KEY" });
    });

    it("returns null when not found", async () => {
      const notFoundError = { statusCode: 404, message: "Not found" };
      mockExecute.mockRejectedValue(notFoundError);
      (CommerceToolsClient.isNotFound as jest.Mock).mockReturnValue(true);

      const client = new CommercetoolsChannelClient();
      const result = await client.getChannelByKey("MISSING_KEY");

      expect(result).toBeNull();
    });

    it("rethrows non-404 errors", async () => {
      const serverError = { statusCode: 500, message: "Server error" };
      mockExecute.mockRejectedValue(serverError);
      (CommerceToolsClient.isNotFound as jest.Mock).mockReturnValue(false);

      const client = new CommercetoolsChannelClient();
      await expect(client.getChannelByKey("KEY")).rejects.toEqual(serverError);
    });
  });

  describe("createChannel", () => {
    it("creates and returns a channel", async () => {
      const channel = { id: "ch2", key: "NEW_KEY" };
      mockExecute.mockResolvedValue({ body: channel });

      const client = new CommercetoolsChannelClient();
      const result = await client.createChannel({
        key: "NEW_KEY",
        name: { en: "New Channel" },
        roles: ["InventorySupply"],
      });

      expect(result).toEqual(channel);
    });
  });

  describe("getInventoryBySkuAndChannel", () => {
    it("returns inventory entry when found", async () => {
      const entry = { id: "inv1", sku: "SKU001" };
      mockExecute.mockResolvedValue({ body: { results: [entry] } });

      const client = new CommercetoolsChannelClient();
      const result = await client.getInventoryBySkuAndChannel("SKU001", "ch1");

      expect(result).toEqual(entry);
    });

    it("returns null when no results", async () => {
      mockExecute.mockResolvedValue({ body: { results: [] } });

      const client = new CommercetoolsChannelClient();
      const result = await client.getInventoryBySkuAndChannel("SKU001", "ch1");

      expect(result).toBeNull();
    });
  });

  describe("createInventory", () => {
    it("creates inventory entry", async () => {
      const entry = { id: "inv1", sku: "SKU001", quantityOnStock: 100 };
      mockExecute.mockResolvedValue({ body: entry });

      const client = new CommercetoolsChannelClient();
      const result = await client.createInventory({
        sku: "SKU001",
        channelId: "ch1",
        custom: baseCustom,
      });

      expect(result).toEqual(entry);
    });

    it("defaults quantityOnStock to zero when quota is missing", async () => {
      const entry = { id: "inv2", sku: "SKU002", quantityOnStock: 0 };
      mockExecute.mockResolvedValue({ body: entry });

      const client = new CommercetoolsChannelClient();
      await client.createInventory({
        sku: "SKU002",
        channelId: "ch1",
        custom: {},
      });

      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            quantityOnStock: 0,
          }),
        }),
      );
    });
  });

  describe("updateInventory", () => {
    it("updates inventory with actions", async () => {
      const inventory = { id: "inv1", version: 1, quantityOnStock: 50 } as any;
      const updated = { id: "inv1", version: 2, quantityOnStock: 100 };
      mockExecute.mockResolvedValue({ body: updated });

      const client = new CommercetoolsChannelClient();
      const result = await client.updateInventory({
        inventory,
        custom: baseCustom,
        quantityOnStock: 100,
      });

      expect(result).toEqual(updated);
    });

    it("calls inventory update API with correct params", async () => {
      const inventory = { id: "inv1", version: 1, quantityOnStock: 50 } as any;
      const updated = { id: "inv1", version: 2, quantityOnStock: 80 };
      mockExecute.mockResolvedValue({ body: updated });

      const client = new CommercetoolsChannelClient();
      const result = await client.updateInventory({
        inventory,
        custom: { quota: 80 },
        quantityOnStock: 80,
      });

      expect(result).toEqual(updated);
      expect(mockWithId).toHaveBeenCalledWith({ ID: "inv1" });
    });

    it("omits changeQuantity action when quantity is unchanged", async () => {
      const inventory = { id: "inv1", version: 1, quantityOnStock: 100 } as any;
      const updated = { id: "inv1", version: 2, quantityOnStock: 100 };
      mockExecute.mockResolvedValue({ body: updated });

      const client = new CommercetoolsChannelClient();
      await client.updateInventory({
        inventory,
        custom: { quota: 100, brand: "BrandX" },
        quantityOnStock: 100,
      });

      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            actions: expect.not.arrayContaining([
              expect.objectContaining({ action: "changeQuantity" }),
            ]),
          }),
        }),
      );
    });
  });

  describe("getChannelsByKeys", () => {
    it("returns channels matching keys", async () => {
      const channels = [{ id: "ch1" }, { id: "ch2" }];
      mockExecute.mockResolvedValue({ body: { results: channels } });

      const client = new CommercetoolsChannelClient();
      const result = await client.getChannelsByKeys(["k1", "k2"]);

      expect(result).toEqual(channels);
    });
  });

  describe("getInventoriesBySkusAndChannel", () => {
    it("returns inventory entries for skus and channel", async () => {
      const entries = [
        { id: "inv1", sku: "SKU001" },
        { id: "inv2", sku: "SKU002" },
      ];
      mockExecute.mockResolvedValue({ body: { results: entries } });

      const client = new CommercetoolsChannelClient();
      const result = await client.getInventoriesBySkusAndChannel(["SKU001", "SKU002"], "ch1");

      expect(result).toEqual(entries);
    });
  });
});

describe("mapCustomFields", () => {
  it("maps all custom fields", () => {
    const result = mapCustomFields(baseCustom);
    expect(result.campaignType).toBe("normal");
    expect(result.brand).toBe("BrandX");
    expect(result.matCode).toBe("SKU001");
    expect(result.depositAmount).toEqual({ centAmount: 500, currencyCode: "THB" });
  });

  it("excludes depositAmount when undefined", () => {
    const result = mapCustomFields({ ...baseCustom, depositAmount: undefined });
    expect(result.depositAmount).toBeUndefined();
  });

  it("returns empty string defaults for missing fields", () => {
    const result = mapCustomFields({});
    expect(result.campaignType).toBe("");
    expect(result.brand).toBe("");
  });
});

describe("buildCustomUpdateActions", () => {
  it("returns setCustomField actions for each field", () => {
    const result = buildCustomUpdateActions(baseCustom);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].action).toBe("setCustomField");
  });
});

describe("buildQuantityUpdateAction", () => {
  it("returns changeQuantity action when quantity differs", () => {
    const inventory = { id: "inv1", version: 1, quantityOnStock: 50 } as any;
    const result = buildQuantityUpdateAction(inventory, 100);
    expect(result).toEqual({ action: "changeQuantity", quantity: 100 });
  });

  it("returns undefined when quantity is the same", () => {
    const inventory = { id: "inv1", version: 1, quantityOnStock: 100 } as any;
    const result = buildQuantityUpdateAction(inventory, 100);
    expect(result).toBeUndefined();
  });
});
