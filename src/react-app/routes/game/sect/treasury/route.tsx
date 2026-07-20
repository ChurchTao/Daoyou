import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkButton, InkCard } from '@app/components/ui';
import { fetchSectShop } from '@app/lib/sect/sectClient';
import { SECT_RANK_LABELS } from '@shared/engine/sect';
import {
  postJson,
  SectPageLoading,
  SectPermissionBoundary,
  SectQueryError,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

export default function SectTreasuryPage() {
  return (
    <SectPermissionBoundary permission="sect.shop.use" sceneKey="treasury">
      <SectTreasuryBody />
    </SectPermissionBoundary>
  );
}

function SectTreasuryBody() {
  const {
    data: shop,
    error,
    reload,
    retry,
  } = useSectResourceQuery('shop', fetchSectShop);
  const { busy, run } = useSectMutation(reload);
  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!shop) return <SectPageLoading sceneKey="treasury" />;
  return (
    <SectScene
      sceneKey="treasury"
      mood="treasury"
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>当前贡献：{shop.contribution}</p>
          <p>轮换周次：{shop.weekKey}</p>
        </div>
      }
    >
      <div className="grid gap-3 border-y-4 border-double border-yellow-950/15 bg-[repeating-linear-gradient(0deg,transparent_0_12rem,rgba(91,61,25,0.08)_12rem_calc(12rem+2px))] py-5 md:grid-cols-2 lg:grid-cols-3">
        {shop.items.map((item) => {
          const remaining = item.stock - item.purchased;
          return (
            <InkCard key={item.id} highlighted={item.rotating}>
              <div className="flex items-start justify-between gap-3">
                <strong>{item.name}</strong>
                <span className="text-crimson text-sm">{item.price} 贡献</span>
              </div>
              <p className="text-ink-secondary mt-2 text-sm leading-6">
                {item.description}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 text-sm leading-6">
                <dt className="text-ink-secondary">身份</dt>
                <dd>{SECT_RANK_LABELS[item.requiredRank]}</dd>
                <dt className="text-ink-secondary">库存</dt>
                <dd>
                  {remaining} / {item.stock}
                </dd>
                <dt className="text-ink-secondary">货架</dt>
                <dd>{item.rotating ? '本周轮换' : '常驻'}</dd>
              </dl>
              <InkButton
                variant="primary"
                disabled={
                  busy || remaining <= 0 || shop.contribution < item.price
                }
                onClick={() =>
                  void run(
                    '/api/sects/current/shop/purchase',
                    postJson({ itemId: item.id, quantity: 1 }),
                    `已兑换「${item.name}」`,
                  )
                }
              >
                {remaining <= 0 ? '本周售罄' : '兑换一份'}
              </InkButton>
            </InkCard>
          );
        })}
      </div>
    </SectScene>
  );
}
