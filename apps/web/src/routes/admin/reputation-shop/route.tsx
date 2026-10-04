import { ItemExchangeShopAdminPage } from '../_components/ItemExchangeShopAdminPage';

export default function AdminReputationShopPage() {
  return (
    <ItemExchangeShopAdminPage
      endpoint="/api/admin/reputation-shop"
      eyebrow="REPUTATION SHOP"
      title="声望商店管理"
      priceLabel="声望价格"
      currencyLabel="声望"
      emptyText="暂未配置声望商店商品。"
      successText="声望商店商品已保存"
    />
  );
}
