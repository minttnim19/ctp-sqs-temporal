const getInstanceMock = jest.fn();

jest.mock("@/infra/adapters/ctp-client", () => ({
  CommerceToolsClient: {
    getInstance: () => getInstanceMock(),
  },
}));

import { CommercetoolsMessageClient } from "@/infra/adapters/ctp-message-client";

describe("CommercetoolsMessageClient", () => {
  beforeEach(() => {
    getInstanceMock.mockReset();
  });

  it("getMessageById trims id and passes expand", async () => {
    const executeMock = jest.fn().mockResolvedValue({ body: { id: "m1" } });
    const getMock = jest.fn(() => ({ execute: executeMock }));
    const withIdMock = jest.fn(() => ({ get: getMock }));
    const messagesMock = jest.fn(() => ({ withId: withIdMock }));

    getInstanceMock.mockReturnValue({
      apiRoot: {
        messages: messagesMock,
      },
    });

    const client = new CommercetoolsMessageClient();
    await expect(client.getMessageById("  msg-1 ", ["foo"])).resolves.toEqual({ id: "m1" });

    expect(messagesMock).toHaveBeenCalledTimes(1);
    expect(withIdMock).toHaveBeenCalledWith({ ID: "msg-1" });
    expect(getMock).toHaveBeenCalledWith({ queryArgs: { expand: ["foo"] } });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("getMessageById uses empty expand by default", async () => {
    const executeMock = jest.fn().mockResolvedValue({ body: { id: "m2" } });
    const getMock = jest.fn(() => ({ execute: executeMock }));
    const withIdMock = jest.fn(() => ({ get: getMock }));
    const messagesMock = jest.fn(() => ({ withId: withIdMock }));

    getInstanceMock.mockReturnValue({
      apiRoot: {
        messages: messagesMock,
      },
    });

    const client = new CommercetoolsMessageClient();
    await expect(client.getMessageById("msg-2")).resolves.toEqual({ id: "m2" });

    expect(withIdMock).toHaveBeenCalledWith({ ID: "msg-2" });
    expect(getMock).toHaveBeenCalledWith({ queryArgs: { expand: [] } });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
