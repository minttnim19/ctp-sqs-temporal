const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
  },
}));

import { CommercetoolsProductClient } from "@/infra/adapters/ctp-product-client";

describe("CommercetoolsProductClient", () => {
  beforeEach(() => {
    getInstanceMock.mockReset();
  });

  it("getProductById expands productType", async () => {
    const executeMock = jest.fn().mockResolvedValue({ body: { id: "p1" } });
    const getMock = jest.fn(() => ({ execute: executeMock }));
    const withIdMock = jest.fn(() => ({ get: getMock }));
    const productsMock = jest.fn(() => ({ withId: withIdMock }));

    getInstanceMock.mockReturnValue({
      apiRoot: {
        products: productsMock,
      },
    });

    const client = new CommercetoolsProductClient();
    await expect(client.getProductById("product-1")).resolves.toEqual({ id: "p1" });

    expect(productsMock).toHaveBeenCalledTimes(1);
    expect(withIdMock).toHaveBeenCalledWith({ ID: "product-1" });
    expect(getMock).toHaveBeenCalledWith({
      queryArgs: {
        expand: ["productType"],
      },
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
