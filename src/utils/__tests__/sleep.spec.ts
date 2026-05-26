import { sleep } from "@/utils/sleep";

describe("utils/sleep", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves after specified milliseconds", async () => {
    const promise = sleep(500);
    const thenSpy = jest.fn();
    promise.then(thenSpy);

    jest.advanceTimersByTime(499);
    await Promise.resolve();
    expect(thenSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(thenSpy).toHaveBeenCalledTimes(1);
  });
});
