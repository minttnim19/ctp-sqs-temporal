import type { Cart } from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export class CommercetoolsCartClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getCartsUpdatedBeforeWithJourney(cutoffIso: string, journey: string): Promise<Cart[]> {
    const limit = 200;
    let lastModifiedAt: string | null = null;
    let lastId: string | null = null;
    const carts: Cart[] = [];

    while (true) {
      const where = this.buildCartWhere(cutoffIso, journey, lastModifiedAt, lastId);
      const response = await this.apiRoot
        .carts()
        .get({
          queryArgs: {
            where,
            sort: ["lastModifiedAt asc", "id asc"],
            limit,
          },
        })
        .execute();

      const results = response.body.results ?? [];
      if (results.length === 0) break;

      carts.push(...results);

      const last = results[results.length - 1];
      lastModifiedAt = last.lastModifiedAt ?? null;
      lastId = last.id ?? null;

      if (results.length < limit) break;
    }

    return carts;
  }

  async cancelCartById(cartId: string, version: number): Promise<Cart> {
    const response = await this.apiRoot
      .carts()
      .withId({ ID: cartId })
      .delete({
        queryArgs: {
          version,
        },
      })
      .execute();

    return response.body;
  }

  private buildCartWhere(
    cutoffIso: string,
    journey: string,
    lastModifiedAt: string | null,
    lastId: string | null,
  ): string {
    let cursorCondition = "";
    if (lastModifiedAt && lastId) {
      cursorCondition = String.raw`
        and (
          lastModifiedAt > "${lastModifiedAt}"
          or (lastModifiedAt = "${lastModifiedAt}" and id > "${lastId}")
        )
      `;
    }

    return String.raw`
      lastModifiedAt <= "${cutoffIso}"
      and custom(fields(journey="${journey}"))
      ${cursorCondition}
    `;
  }
}
