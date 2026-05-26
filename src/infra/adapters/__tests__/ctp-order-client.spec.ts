const executeMock = jest.fn();
const getMock = jest.fn(() => ({ execute: executeMock }));
const withIdOrdersMock = jest.fn(() => ({ get: getMock }));
const ordersMock = jest.fn(() => ({ withId: withIdOrdersMock }));
const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
  },
}));

import { CommercetoolsOrderClient } from "@/infra/adapters/ctp-order-client";

describe("CommercetoolsOrderClient", () => {
  let client: CommercetoolsOrderClient;

  beforeEach(() => {
    getInstanceMock.mockReset();
    executeMock.mockReset();
    getMock.mockClear();
    withIdOrdersMock.mockClear();
    ordersMock.mockClear();

    getInstanceMock.mockReturnValue({
      apiRoot: {
        orders: ordersMock,
      },
    });

    client = new CommercetoolsOrderClient();
  });

  describe("getOrderById", () => {
    it("trims the id, calls CTP and returns the body", async () => {
      executeMock.mockResolvedValue({ body: { id: "order-1" } });

      await expect(client.getOrderById("  order-1 ")).resolves.toEqual({
        id: "order-1",
      });

      expect(withIdOrdersMock).toHaveBeenCalledWith({ ID: "order-1" });
      expect(getMock).toHaveBeenCalledWith({
        queryArgs: { expand: ["state", "paymentInfo.payments[*]"] },
      });
      expect(executeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("toCustomFieldActions", () => {
    it("converts a fields map to setCustomField actions", () => {
      const actions = client.toCustomFieldActions({
        errorNote: "some error",
        foo: 42,
      });

      expect(actions).toEqual([
        { action: "setCustomField", name: "errorNote", value: "some error" },
        { action: "setCustomField", name: "foo", value: 42 },
      ]);
    });

    it("skips fields whose value is undefined", () => {
      const actions = client.toCustomFieldActions({
        defined: "yes",
        skip: undefined,
      });

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ name: "defined" });
    });
  });

  describe("toTransitionState", () => {
    it("builds a transitionState action with typeId='state'", () => {
      const action = client.toTransitionState("insert_booking_tsm_prebook");

      expect(action).toEqual({
        action: "transitionState",
        state: {
          typeId: "state",
          key: "insert_booking_tsm_prebook",
        },
      });
    });
  });
});
