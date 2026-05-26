import { Connection, Client } from "@temporalio/client";

import { env } from "@/config/env";

let client: Client | undefined;
let connection: Connection | undefined;

export async function getTemporalConnection(): Promise<Connection> {
  if (connection) return connection;
  const tls = env.TEMPORAL_TLS_ENABLED
    ? {
        serverNameOverride: env.TEMPORAL_TLS_SERVER_NAME,
        serverRootCACertificate: env.TEMPORAL_TLS_CA_CERT
          ? Buffer.from(env.TEMPORAL_TLS_CA_CERT)
          : undefined,
        clientCertPair:
          env.TEMPORAL_TLS_CLIENT_CERT && env.TEMPORAL_TLS_CLIENT_KEY
            ? {
                crt: Buffer.from(env.TEMPORAL_TLS_CLIENT_CERT),
                key: Buffer.from(env.TEMPORAL_TLS_CLIENT_KEY),
              }
            : undefined,
      }
    : false;
  connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
    connectTimeout: `${env.TEMPORAL_CONNECTION_TIMEOUT}ms`,
    tls,
  });
  return connection;
}

export async function getTemporalClient(): Promise<Client> {
  if (client) return client;
  const conn = await getTemporalConnection();
  client = new Client({ connection: conn, namespace: env.TEMPORAL_NAMESPACE });
  return client;
}
