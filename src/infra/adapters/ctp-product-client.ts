import type { Product } from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export class CommercetoolsProductClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getProductById(productId: string): Promise<Product> {
    const { body } = await this.apiRoot
      .products()
      .withId({ ID: productId })
      .get({
        queryArgs: {
          expand: ["productType"],
        },
      })
      .execute();

    return body;
  }
}
