const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
  },
}));

import { CommercetoolsStandalonePriceClient } from "@/infra/adapters/ctp-standalone-price-client";

describe("CommercetoolsStandalonePriceClient", () => {
  beforeEach(() => {
    getInstanceMock.mockReset();
  });

  it("getStandalonePriceById returns body", async () => {
    const executeMock = jest.fn().mockResolvedValue({ body: { id: "sp1" } });
    const getMock = jest.fn(() => ({ execute: executeMock }));
    const withIdMock = jest.fn(() => ({ get: getMock }));
    const standalonePricesMock = jest.fn(() => ({ withId: withIdMock }));

    getInstanceMock.mockReturnValue({
      apiRoot: {
        standalonePrices: standalonePricesMock,
      },
    });

    const client = new CommercetoolsStandalonePriceClient();
    await expect(client.getStandalonePriceById("sp-1")).resolves.toEqual({ id: "sp1" });

    expect(standalonePricesMock).toHaveBeenCalledTimes(1);
    expect(withIdMock).toHaveBeenCalledWith({ ID: "sp-1" });
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
