import type {
  Channel,
  ChannelDraft,
  InventoryEntry,
  InventoryEntryUpdateAction,
} from "@commercetools/platform-sdk";

import { CommerceToolsClient } from "@/infra/adapters/ctp-client";

export class CommercetoolsChannelClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot;

  async getChannelByKey(key: string): Promise<Channel | null> {
    try {
      const { body } = await this.apiRoot.channels().withKey({ key }).get().execute();

      return body;
    } catch (error: unknown) {
      if (CommerceToolsClient.isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async createChannel(draft: ChannelDraft): Promise<Channel> {
    const { body } = await this.apiRoot.channels().post({ body: draft }).execute();

    return body;
  }

  async getInventoryBySkuAndChannel(
    sku: string,
    channelId: string,
  ): Promise<InventoryEntry | null> {
    const { body } = await this.apiRoot
      .inventory()
      .get({
        queryArgs: {
          where: `sku="${sku}" and supplyChannel(id="${channelId}")`,
        },
      })
      .execute();

    return body.results.length > 0 ? body.results[0] : null;
  }

  async createInventory(params: {
    sku: string;
    channelId: string;
    custom: PrebookCustom;
  }): Promise<InventoryEntry> {
    const { sku, channelId, custom } = params;

    const quantityOnStock = custom.quota ?? 0;

    const { body } = await this.apiRoot
      .inventory()
      .post({
        body: {
          sku,
          quantityOnStock,

          supplyChannel: {
            typeId: "channel",
            id: channelId,
          },

          custom: {
            type: {
              typeId: "type",
              key: "custom-for-prebook",
            },
            fields: mapCustomFields(custom),
          },
        },
      })
      .execute();

    return body;
  }

  async updateInventory(params: {
    inventory: InventoryEntry;
    custom: PrebookCustom;
    quantityOnStock: number;
  }): Promise<InventoryEntry> {
    const { inventory, custom, quantityOnStock } = params;

    const customActions = buildCustomUpdateActions(custom);
    const quantityAction = buildQuantityUpdateAction(inventory, quantityOnStock);
    const actions = quantityAction ? [...customActions, quantityAction] : customActions;

    const { body } = await this.apiRoot
      .inventory()
      .withId({ ID: inventory.id })
      .post({
        body: {
          version: inventory.version,
          actions,
        },
      })
      .execute();

    return body;
  }

  async getChannelsByKeys(keys: string[]) {
    const where = keys.map((k) => `key="${k}"`).join(" or ");

    const res = await this.apiRoot
      .channels()
      .get({
        queryArgs: { where },
      })
      .execute();

    return res.body.results;
  }

  async getInventoriesBySkusAndChannel(skus: string[], channelId: string) {
    const quotedSkus = skus.map((sku) => `"${sku}"`).join(",");
    const skuPredicate = `sku in (${quotedSkus})`;
    const channelPredicate = `supplyChannel(id="${channelId}")`;
    const where = `${skuPredicate} and ${channelPredicate}`;

    const res = await this.apiRoot
      .inventory()
      .get({
        queryArgs: { where },
      })
      .execute();

    return res.body.results;
  }
}

export type PrebookCustom = {
  campaignType?: string;
  brand?: string;
  matCode?: string;
  displayName?: string;
  quota?: number;
  serviceCode?: string;
  depositAmount?: number;
  channel?: string;
  bookingStart?: string;
  bookingEnd?: string;
  pickupStart?: string;
  pickupMessage?: string;
  bookingProductGroup?: string;
};

export function mapCustomFields(custom: PrebookCustom) {
  const fields = {
    campaignType: custom.campaignType ?? "",
    brand: custom.brand ?? "",
    matCode: custom.matCode ?? "",
    displayName: custom.displayName ?? "",
    quota: custom.quota ?? 0,
    serviceCode: custom.serviceCode ?? "",

    depositAmount: custom.depositAmount
      ? {
          centAmount: custom.depositAmount,
          currencyCode: "THB",
        }
      : undefined,

    channel: custom.channel ?? "",
    bookingStart: custom.bookingStart ?? undefined,
    bookingEnd: custom.bookingEnd ?? undefined,
    pickupStart: custom.pickupStart ?? undefined,
    pickupMessage: custom.pickupMessage ?? "",
    bookingProductGroup: custom.bookingProductGroup ?? "",
  };

  return Object.fromEntries(Object.entries(fields).filter(([_, v]) => v !== undefined));
}

export function buildCustomUpdateActions(custom: PrebookCustom): InventoryEntryUpdateAction[] {
  const fields = mapCustomFields(custom);

  return Object.entries(fields)
    .filter(([_, v]) => v !== undefined)
    .map(([name, value]) => ({
      action: "setCustomField" as const,
      name,
      value,
    }));
}

export function buildQuantityUpdateAction(
  inventory: InventoryEntry,
  quantityOnStock: number,
): InventoryEntryUpdateAction | undefined {
  if (inventory.quantityOnStock === quantityOnStock) {
    return undefined;
  }

  return {
    action: "changeQuantity",
    quantity: quantityOnStock,
  };
}
