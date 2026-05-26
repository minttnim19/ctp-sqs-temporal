// Mock SQSClient to capture constructor args
const SQSClientMock = jest.fn().mockImplementation((cfg) => ({ cfg }));
jest.mock("@aws-sdk/client-sqs", () => ({ SQSClient: SQSClientMock }));

describe("infra/aws/sqs-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    SQSClientMock.mockClear();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("constructs SQSClient with env-based region/endpoint and credentials", async () => {
    process.env.AWS_REGION = "ap-southeast-1";
    process.env.SQS_ENDPOINT = "http://localstack:4566";
    process.env.AWS_ACCESS_KEY_ID = "ak";
    process.env.AWS_SECRET_ACCESS_KEY = "sk";

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/aws/sqs-client");
    });

    expect(SQSClientMock).toHaveBeenCalledTimes(1);
    const arg = SQSClientMock.mock.calls[0][0];
    expect(arg).toMatchObject({
      region: "ap-southeast-1",
      endpoint: "http://localstack:4566",
      credentials: { accessKeyId: "ak", secretAccessKey: "sk" },
    });
  });

  it("falls back to default test credentials when env missing", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_REGION = "us-east-1";
    delete process.env.SQS_ENDPOINT;

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/aws/sqs-client");
    });

    const arg = SQSClientMock.mock.calls.pop()?.[0];
    expect(arg).toMatchObject({ credentials: { accessKeyId: "test", secretAccessKey: "test" } });
  });

  it("supports mixed credentials presence (id present, secret missing)", async () => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "only-id";
    delete process.env.AWS_SECRET_ACCESS_KEY;
    await jest.isolateModulesAsync(async () => {
      await import("@/infra/aws/sqs-client");
    });
    const arg = SQSClientMock.mock.calls.pop()?.[0];
    expect(arg).toMatchObject({ credentials: { accessKeyId: "only-id", secretAccessKey: "test" } });
  });

  it("treats explicit undefined credentials the same as missing", async () => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = undefined;
    process.env.AWS_SECRET_ACCESS_KEY = undefined;

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/aws/sqs-client");
    });

    const arg = SQSClientMock.mock.calls.pop()?.[0];
    expect(arg).toMatchObject({ credentials: { accessKeyId: "test", secretAccessKey: "test" } });
  });
});
