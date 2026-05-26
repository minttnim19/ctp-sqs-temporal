import type { Message } from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export type MessageWithState = Message & {
  state?: { obj?: { key?: string | null } };
  oldState?: { obj?: { key?: string | null } };
};

export class CommercetoolsMessageClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getMessageById<T = Message>(messageId: string, expand: string[] = []): Promise<T> {
    const { body } = await this.apiRoot
      .messages()
      .withId({ ID: messageId.trim() })
      .get({
        queryArgs: {
          expand,
        },
      })
      .execute();

    return body as T;
  }
}
