describe("infra/temporal/temporal-client", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("caches connection and client (tls disabled)", async () => {
    await jest.isolateModulesAsync(async () => {
      const connectMock = jest.fn(async () => ({ id: "conn-1" }));
      const clientCtorMock = jest
        .fn()
        .mockImplementation((opts: any) => ({ opts, connection: opts.connection }));

      jest.doMock("@temporalio/client", () => ({
        Connection: { connect: connectMock },
        Client: clientCtorMock,
      }));

      jest.doMock("@/config/env", () => ({
        env: {
          TEMPORAL_TLS_ENABLED: false,
          TEMPORAL_TLS_SERVER_NAME: undefined,
          TEMPORAL_TLS_CA_CERT: undefined,
          TEMPORAL_TLS_CLIENT_CERT: undefined,
          TEMPORAL_TLS_CLIENT_KEY: undefined,
          TEMPORAL_ADDRESS: "temporal:7233",
          TEMPORAL_CONNECTION_TIMEOUT: 30000,
          TEMPORAL_NAMESPACE: "default",
        },
      }));

      const { getTemporalConnection, getTemporalClient } =
        await import("@/infra/temporal/temporal-client");

      const conn1 = await getTemporalConnection();
      const conn2 = await getTemporalConnection();
      expect(connectMock).toHaveBeenCalledTimes(1);
      expect(conn2).toBe(conn1);
      expect(connectMock).toHaveBeenCalledWith({
        address: "temporal:7233",
        connectTimeout: "30000ms",
        tls: false,
      });

      const client1 = await getTemporalClient();
      const client2 = await getTemporalClient();
      expect(clientCtorMock).toHaveBeenCalledTimes(1);
      expect(client2).toBe(client1);
      expect(clientCtorMock).toHaveBeenCalledWith({
        connection: conn1,
        namespace: "default",
      });
    });
  });

  it("passes tls options when enabled", async () => {
    await jest.isolateModulesAsync(async () => {
      const connectMock = jest.fn(async () => ({ id: "conn-tls" }));
      jest.doMock("@temporalio/client", () => ({
        Connection: { connect: connectMock },
        Client: jest.fn(),
      }));

      jest.doMock("@/config/env", () => ({
        env: {
          TEMPORAL_TLS_ENABLED: true,
          TEMPORAL_TLS_SERVER_NAME: "server-name",
          TEMPORAL_TLS_CA_CERT: "ca-cert",
          TEMPORAL_TLS_CLIENT_CERT: "client-cert",
          TEMPORAL_TLS_CLIENT_KEY: "client-key",
          TEMPORAL_ADDRESS: "temporal:7233",
          TEMPORAL_CONNECTION_TIMEOUT: 10000,
          TEMPORAL_NAMESPACE: "default",
        },
      }));

      const { getTemporalConnection } = await import("@/infra/temporal/temporal-client");
      await getTemporalConnection();

      const call = (connectMock.mock.calls as any[])[0][0];
      expect(call.address).toBe("temporal:7233");
      expect(call.connectTimeout).toBe("10000ms");
      expect(call.tls).toMatchObject({
        serverNameOverride: "server-name",
      });
      expect(Buffer.isBuffer(call.tls.serverRootCACertificate)).toBe(true);
      expect(Buffer.isBuffer(call.tls.clientCertPair.crt)).toBe(true);
      expect(Buffer.isBuffer(call.tls.clientCertPair.key)).toBe(true);
    });
  });

  it("handles tls enabled without optional certs", async () => {
    await jest.isolateModulesAsync(async () => {
      const connectMock = jest.fn(async () => ({ id: "conn-tls-2" }));
      jest.doMock("@temporalio/client", () => ({
        Connection: { connect: connectMock },
        Client: jest.fn(),
      }));

      jest.doMock("@/config/env", () => ({
        env: {
          TEMPORAL_TLS_ENABLED: true,
          TEMPORAL_TLS_SERVER_NAME: undefined,
          TEMPORAL_TLS_CA_CERT: undefined,
          TEMPORAL_TLS_CLIENT_CERT: undefined,
          TEMPORAL_TLS_CLIENT_KEY: undefined,
          TEMPORAL_ADDRESS: "temporal:7233",
          TEMPORAL_CONNECTION_TIMEOUT: 5000,
          TEMPORAL_NAMESPACE: "default",
        },
      }));

      const { getTemporalConnection } = await import("@/infra/temporal/temporal-client");
      await getTemporalConnection();

      const call = (connectMock.mock.calls as any[])[0][0];
      expect(call.tls).toEqual({
        serverNameOverride: undefined,
        serverRootCACertificate: undefined,
        clientCertPair: undefined,
      });
    });
  });
});
