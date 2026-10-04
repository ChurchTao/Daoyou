import { ItemExchangeShopAdminPage } from '../_components/ItemExchangeShopAdminPage';

export default function AdminSectShopPage() {
  return (
    <ItemExchangeShopAdminPage
      endpoint="/api/admin/sect-shop"
      eyebrow="SECT TREASURY"
      title="宗门宝库管理"
      priceLabel="贡献价格"
      currencyLabel="宗门贡献"
      emptyText="暂未配置宗门宝库商品。"
      successText="宗门宝库商品已保存"
    />
  );
}
