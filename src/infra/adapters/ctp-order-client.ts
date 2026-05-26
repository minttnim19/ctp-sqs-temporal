import type { Order, OrderUpdateAction } from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export class CommercetoolsOrderClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getOrderById(orderId: string): Promise<Order> {
    const { body } = await this.apiRoot
      .orders()
      .withId({ ID: orderId.trim() })
      .get({ queryArgs: { expand: ["state", "paymentInfo.payments[*]"] } })
      .execute();
    return body;
  }

  toCustomFieldActions(fields: Record<string, unknown>): OrderUpdateAction[] {
    const actions: OrderUpdateAction[] = [];
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined) {
        actions.push({ action: "setCustomField", name, value });
      }
    }
    return actions;
  }

  toTransitionState(state: string): OrderUpdateAction {
    return {
      action: "transitionState",
      state: {
        typeId: "state",
        key: state,
      },
    };
  }
}
