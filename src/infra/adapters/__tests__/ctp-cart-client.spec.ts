const mockExecute = jest.fn();
const mockGet = jest.fn(() => ({ execute: mockExecute }));
const mockDelete = jest.fn(() => ({ execute: mockExecute }));
const mockWithId = jest.fn(() => ({ get: mockGet, delete: mockDelete }));
const mockCarts = jest.fn(() => ({ get: mockGet, withId: mockWithId }));
const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
  },
}));

import { CommercetoolsCartClient } from "@/infra/adapters/ctp-cart-client";

describe("CommercetoolsCartClient", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockGet.mockReset().mockReturnValue({ execute: mockExecute });
    mockDelete.mockReset().mockReturnValue({ execute: mockExecute });
    mockWithId.mockReset().mockReturnValue({ get: mockGet, delete: mockDelete });
    mockCarts.mockReset().mockReturnValue({ get: mockGet, withId: mockWithId });
    getInstanceMock.mockReturnValue({ apiRoot: { carts: mockCarts } });
  });

  describe("getCartsUpdatedBeforeWithJourney", () => {
    it("returns all carts in a single page", async () => {
      const carts = [
        { id: "c1", version: 1, lastModifiedAt: "2024-01-01T00:00:00Z" },
        { id: "c2", version: 2, lastModifiedAt: "2024-01-02T00:00:00Z" },
      ];
      mockExecute.mockResolvedValue({ body: { results: carts } });

      const client = new CommercetoolsCartClient();
      const result = await client.getCartsUpdatedBeforeWithJourney(
        "2024-01-10T00:00:00Z",
        "prebook",
      );

      expect(result).toEqual(carts);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("paginates across multiple pages", async () => {
      const page1 = Array.from({ length: 200 }, (_, i) => ({
        id: `c${i}`,
        version: 1,
        lastModifiedAt: `2024-01-0${(i % 9) + 1}T00:00:00Z`,
      }));
      const page2 = [{ id: "c200", version: 1, lastModifiedAt: "2024-01-10T00:00:00Z" }];

      mockExecute
        .mockResolvedValueOnce({ body: { results: page1 } })
        .mockResolvedValueOnce({ body: { results: page2 } })
        .mockResolvedValueOnce({ body: { results: [] } });

      const client = new CommercetoolsCartClient();
      const result = await client.getCartsUpdatedBeforeWithJourney(
        "2024-01-10T00:00:00Z",
        "prebook",
      );

      expect(result).toHaveLength(201);
    });

    it("returns empty array when no carts found", async () => {
      mockExecute.mockResolvedValue({ body: { results: [] } });

      const client = new CommercetoolsCartClient();
      const result = await client.getCartsUpdatedBeforeWithJourney(
        "2024-01-10T00:00:00Z",
        "prebook",
      );

      expect(result).toEqual([]);
    });

    it("returns empty array when response body has no results field", async () => {
      mockExecute.mockResolvedValue({ body: {} });

      const client = new CommercetoolsCartClient();
      const result = await client.getCartsUpdatedBeforeWithJourney(
        "2024-01-10T00:00:00Z",
        "prebook",
      );

      expect(result).toEqual([]);
    });

    it("keeps paginating safely when last cart cursor fields are missing", async () => {
      const page1 = Array.from({ length: 200 }, (_, i) => ({
        id: i === 199 ? undefined : `c${i}`,
        version: 1,
        lastModifiedAt: i === 199 ? undefined : `2024-01-0${(i % 9) + 1}T00:00:00Z`,
      }));
      const page2 = [{ id: "c200", version: 1, lastModifiedAt: "2024-01-10T00:00:00Z" }];

      mockExecute
        .mockResolvedValueOnce({ body: { results: page1 } })
        .mockResolvedValueOnce({ body: { results: page2 } });

      const client = new CommercetoolsCartClient();
      const result = await client.getCartsUpdatedBeforeWithJourney(
        "2024-01-10T00:00:00Z",
        "prebook",
      );

      expect(result).toHaveLength(201);
      const secondCallWhere = (mockGet.mock.calls as any[])[1][0].queryArgs.where;
      expect(secondCallWhere).not.toContain('lastModifiedAt > "');
      expect(secondCallWhere).not.toContain('and id > "');
    });
  });

  describe("cancelCartById", () => {
    it("deletes cart and returns body", async () => {
      const cart = { id: "cart-1", version: 5 };
      mockExecute.mockResolvedValue({ body: cart });

      const client = new CommercetoolsCartClient();
      const result = await client.cancelCartById("cart-1", 5);

      expect(result).toEqual(cart);
      expect(mockWithId).toHaveBeenCalledWith({ ID: "cart-1" });
      expect(mockDelete).toHaveBeenCalledWith({ queryArgs: { version: 5 } });
    });
  });
});
