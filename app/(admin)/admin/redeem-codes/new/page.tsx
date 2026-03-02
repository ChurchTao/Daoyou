import { getRedeemPresetOptions } from '@/config/redeemRewardPresets';
import { RedeemCodeCreateForm } from '../_components/RedeemCodeCreateForm';

export default function NewRedeemCodePage() {
  const presetOptions = getRedeemPresetOptions();

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          NEW REDEEM CODE
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">新建兑换码</h2>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <RedeemCodeCreateForm presetOptions={presetOptions} />
      </section>
    </div>
  );
}
