const withProjectKeyMock = jest.fn();
const withClientCredentialsFlowMock = jest.fn();
const withHttpMiddlewareMock = jest.fn();
const buildMock = jest.fn();

jest.mock("@commercetools/sdk-client-v2", () => ({
  ClientBuilder: jest.fn().mockImplementation(() => ({
    withProjectKey: withProjectKeyMock,
    withClientCredentialsFlow: withClientCredentialsFlowMock,
    withHttpMiddleware: withHttpMiddlewareMock,
    build: buildMock,
  })),
}));

const createApiBuilderFromCtpClientMock = jest.fn();

jest.mock("@commercetools/platform-sdk", () => ({
  createApiBuilderFromCtpClient: (...args: unknown[]) => createApiBuilderFromCtpClientMock(...args),
}));

import { env } from "@/config/env";
import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

describe("CommerceToolsClient", () => {
  beforeEach(() => {
    (CommerceToolsClient as unknown as { instance?: CommerceToolsClient }).instance = undefined;
    withProjectKeyMock.mockReset().mockReturnThis();
    withClientCredentialsFlowMock.mockReset().mockReturnThis();
    withHttpMiddlewareMock.mockReset().mockReturnThis();
    buildMock.mockReset();
    createApiBuilderFromCtpClientMock.mockReset();
  });

  it("creates a singleton and configures apiRoot", () => {
    const builtClient = { name: "ctp" };
    const apiRootValue = { apiRoot: true };
    const apiWithProjectKeyMock = jest.fn(() => apiRootValue);

    buildMock.mockReturnValue(builtClient);
    createApiBuilderFromCtpClientMock.mockReturnValue({
      withProjectKey: apiWithProjectKeyMock,
    });

    const instance = CommerceToolsClient.getInstance();

    expect(withProjectKeyMock).toHaveBeenCalledWith(env.CTP_PROJECT_KEY);
    expect(withClientCredentialsFlowMock).toHaveBeenCalledTimes(1);
    expect(withHttpMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(buildMock).toHaveBeenCalledTimes(1);
    expect(createApiBuilderFromCtpClientMock).toHaveBeenCalledWith(builtClient);
    expect(apiWithProjectKeyMock).toHaveBeenCalledWith({ projectKey: env.CTP_PROJECT_KEY });
    expect(instance.apiRoot).toBe(apiRootValue);

    const instance2 = CommerceToolsClient.getInstance();
    expect(instance2).toBe(instance);
  });

  it("isCTHttpError returns true for object with numeric statusCode", () => {
    expect(CommerceToolsClient.isCTHttpError({ statusCode: 404, message: "Not found" })).toBe(true);
  });

  it("isCTHttpError returns false for null", () => {
    expect(CommerceToolsClient.isCTHttpError(null)).toBe(false);
  });

  it("isCTHttpError returns false for plain Error", () => {
    expect(CommerceToolsClient.isCTHttpError(new Error("oops"))).toBe(false);
  });

  it("isCTHttpError returns false when statusCode is string", () => {
    expect(CommerceToolsClient.isCTHttpError({ statusCode: "404", message: "x" })).toBe(false);
  });

  it("isNotFound returns true for 404 statusCode", () => {
    expect(CommerceToolsClient.isNotFound({ statusCode: 404, message: "Not found" })).toBe(true);
  });

  it("isNotFound returns false for 500 statusCode", () => {
    expect(CommerceToolsClient.isNotFound({ statusCode: 500, message: "Error" })).toBe(false);
  });

  it("isNotFound returns false for non-CT error", () => {
    expect(CommerceToolsClient.isNotFound(new Error("oops"))).toBe(false);
  });
});
