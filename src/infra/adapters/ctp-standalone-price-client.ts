import type { StandalonePrice } from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export class CommercetoolsStandalonePriceClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getStandalonePriceById(id: string): Promise<StandalonePrice> {
    const { body } = await this.apiRoot.standalonePrices().withId({ ID: id }).get().execute();
    return body;
  }
}
