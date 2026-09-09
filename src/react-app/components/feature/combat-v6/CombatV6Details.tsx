import { useEffect, useRef } from 'react';
import type { CombatV6Session, CombatV6Unit } from './session';
const attributeLabels: Record<string, string> = {
  physicalAtk: '物攻',
  physicalDef: '物防',
  magicAtk: '法攻',
  magicDef: '法防',
  speed: '速度',
  healPower: '治疗',
};
export function CombatV6Details({
  detailUnit,
  label,
  display,
  onClose,
}: {
  detailUnit: CombatV6Unit;
  label: string;
  display: CombatV6Session['display'];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="cv6-dialog"
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      aria-labelledby="cv6-detail-title"
    >
      <header>
        <h2 id="cv6-detail-title">{label}</h2>
        <button onClick={() => onClose()}>关闭</button>
      </header>
      {detailUnit && (
        <div className="cv6-detail-body">
          <dl>
            <dt>气血</dt>
            <dd className="font-mono">
              {detailUnit.publicBars
                ? `${detailUnit.hp / 100}%`
                : `${detailUnit.hp} / ${detailUnit.maxHp}`}
            </dd>
            <dt>法力</dt>
            <dd className="font-mono">
              {detailUnit.publicBars
                ? `${detailUnit.mp / 100}%`
                : `${detailUnit.mp} / ${detailUnit.maxMp}`}
            </dd>
            <dt>护盾</dt>
            <dd className="font-mono">
              {detailUnit.publicBars
                ? `${detailUnit.barriers.reduce((sum, b) => sum + b.current, 0) / 100}% 气血上限`
                : detailUnit.barriers.reduce((sum, b) => sum + b.current, 0)}
            </dd>
            {!detailUnit.publicBars && (
              <>
                <dt>伤势</dt>
                <dd className="font-mono">
                  {detailUnit.wound}（可恢复至{' '}
                  {Math.max(1, detailUnit.maxHp - detailUnit.wound)}）
                </dd>
              </>
            )}
            {detailUnit.resources.map((r) => (
              <div className="cv6-dl-row" key={r.id}>
                <dt>{r.name}</dt>
                <dd className="font-mono">
                  {r.current} / {r.max}
                </dd>
              </div>
            ))}
            {Object.entries(detailUnit.attributes ?? {}).map(([key, value]) => (
              <div className="cv6-dl-row" key={key}>
                <dt>{attributeLabels[key] ?? '属性'}</dt>
                <dd className="font-mono">{Math.round(value)}</dd>
              </div>
            ))}
          </dl>
          <ul>
            {detailUnit.statuses.map((s) => (
              <li key={s.id}>
                {s.name ?? display?.statuses[s.id] ?? '未知状态'} ·{' '}
                {s.remainingRounds} 回合
                {s.stacks > 1 ? ` · ${s.stacks} 层` : ''}
              </li>
            ))}
            {detailUnit.barriers.map((b) => (
              <li key={b.id}>
                {b.name} ·{' '}
                {detailUnit.publicBars ? `${b.current / 100}%` : b.current} ·{' '}
                {b.remainingRounds} 回合
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}
