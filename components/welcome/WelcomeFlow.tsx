'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { useWelcomeStatus } from '@/lib/hooks/useWelcomeStatus';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkButton } from '../ui';
import { BookCover } from './BookCover';
import { BookPage } from './BookPage';
import { TypewriterText } from './TypewriterText';

type WelcomeStep = 'cover' | 'page1' | 'page2';

/**
 * 古籍欢迎页主流程控制组件
 * 管理封面 → 第一页 → 第二页的流转
 */
export function WelcomeFlow() {
  const router = useRouter();
  const { recordVisit, setSkipWelcome } = useWelcomeStatus();
  const { cultivator, isLoading: cultivatorLoading } = useCultivatorBundle();

  // 翻页动画状态管理
  const [displayStep, setDisplayStep] = useState<WelcomeStep>('cover'); // 当前显示的底层页面（目标页面）
  const [exitingStep, setExitingStep] = useState<WelcomeStep | null>(null); //正在翻走的顶层页面
  const [page1Complete, setPage1Complete] = useState(false);

  // 页面挂载时记录访问
  useEffect(() => {
    recordVisit();
  }, [recordVisit]);

  // 翻页触发
  const goToNextStep = () => {
    if (exitingStep) return; // 防重复点击

    let next: WelcomeStep | null = null;
    if (displayStep === 'cover') next = 'page1';
    else if (displayStep === 'page1') next = 'page2';

    if (next) {
      // 1. 设置当前页为"正在翻走"的页
      setExitingStep(displayStep);
      // 2. 设置底层显露出的页为下一页
      setDisplayStep(next);

      // 3. 动画结束后清除"正在翻走"的页
      setTimeout(() => {
        setExitingStep(null);
      }, 1500); // 与CSS动画时长保持一致: 1.5s
    }
  };

  // 跳过开场
  const handleSkip = () => {
    setSkipWelcome(true);
    router.push('/');
  };

  // 继续修行（进入主页）
  const handleContinue = () => {
    router.push('/');
  };

  // 开启修行（创建角色）
  const handleCreate = () => {
    router.push('/create');
  };

  // 子组件渲染辅助函数
  const renderStepContent = (step: WelcomeStep) => {
    switch (step) {
      case 'cover':
        return <BookCover onClick={goToNextStep} />;

      case 'page1':
        // 计算序言打字机完成的时间
        const poemDelay1 = 500; // 稍微推迟一点，等翻页过半
        const poemDelay2 = 2100;
        const poemDelay3 = 3300;
        const poemDelay4 = 4500;
        const poemDelay5 = 5600;

        return (
          <BookPage pageNumber={1} showPageNumber>
            <div className="space-y-12">
              {/* 卷首语 */}
              <div className="space-y-6 text-center">
                <h2 className="font-ma-shan-zheng mb-8 text-xl tracking-widest text-amber-900/70 md:text-2xl">
                  《万界道友录·序》
                </h2>

                <div className="space-y-4 text-lg leading-loose text-amber-900 md:text-xl">
                  <TypewriterText
                    text="自盘古开天，三千大世界并立"
                    speed={80}
                    startDelay={poemDelay1}
                    className="block"
                  />
                  <TypewriterText
                    text="有灵根者，可踏仙途"
                    speed={80}
                    startDelay={poemDelay2}
                    className="block"
                  />
                  <TypewriterText
                    text="有慧根者，可证长生"
                    speed={80}
                    startDelay={poemDelay3}
                    className="block"
                  />
                </div>

                <div className="space-y-4 pt-6 text-lg leading-loose text-amber-800/90 md:text-xl">
                  <TypewriterText
                    text="你，便是那冥冥中的有缘人"
                    speed={80}
                    startDelay={poemDelay4}
                    className="block"
                  />
                  <TypewriterText
                    text="道友，准备好了吗？"
                    speed={80}
                    startDelay={poemDelay5}
                    className="block"
                    onComplete={() => setPage1Complete(true)}
                  />
                </div>
              </div>

              {/* 继续按钮 */}
              {page1Complete && (
                <div className="animate-fade-in pt-8 text-center">
                  <InkButton
                    onClick={goToNextStep}
                    variant="primary"
                    className="px-8 py-3 text-lg"
                  >
                    继 续
                  </InkButton>
                </div>
              )}
            </div>
          </BookPage>
        );

      case 'page2':
        const hasCultivator = !!cultivator && !cultivatorLoading;
        return (
          <BookPage pageNumber={2} showPageNumber>
            <div className="space-y-12 text-center">
              {cultivatorLoading ? (
                <p className="animate-pulse text-lg text-amber-800/60">
                  正在查验道身……
                </p>
              ) : hasCultivator ? (
                // 有角色 - 欢迎回归
                <>
                  <div className="space-y-6">
                    <h2 className="text-2xl tracking-widest text-amber-900/70">
                      道友归来
                    </h2>

                    <div className="space-y-4 text-lg text-amber-900">
                      <TypewriterText
                        text={`道友【${cultivator.name}】`}
                        speed={80}
                        startDelay={800} // Add delay for page flip
                        className="block"
                      />
                      <TypewriterText
                        text={`${cultivator.realm} ${cultivator.realm_stage}`}
                        speed={80}
                        startDelay={1800}
                        className="block text-amber-800/80"
                      />
                      <TypewriterText
                        text={`寿元：${cultivator.age}/${cultivator.lifespan}`}
                        speed={80}
                        startDelay={2800}
                        className="block text-base text-amber-800/70"
                      />
                    </div>

                    <div className="pt-4">
                      <TypewriterText
                        text="道心可还稳固？"
                        speed={100}
                        startDelay={3800}
                        className="block text-lg text-amber-800/80"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-8">
                    <InkButton
                      onClick={handleContinue}
                      variant="primary"
                      className="px-8 py-3 text-lg"
                    >
                      继续修行
                    </InkButton>
                  </div>
                </>
              ) : (
                // 无角色 - 引导创建
                <>
                  <div className="space-y-6">
                    <h2 className="text-xl tracking-widest text-amber-900/70 md:text-2xl">
                      初入仙途
                    </h2>

                    <div className="space-y-4 text-lg leading-loose text-amber-900">
                      <TypewriterText
                        text="道友尚未凝聚道身"
                        speed={80}
                        startDelay={800}
                        className="block"
                      />
                      <TypewriterText
                        text="需先觉醒灵根"
                        speed={80}
                        startDelay={2000}
                        className="block"
                      />
                      <TypewriterText
                        text="方可踏入仙途"
                        speed={80}
                        startDelay={3000}
                        className="block"
                      />
                    </div>
                  </div>

                  <div className="pt-8">
                    <InkButton
                      onClick={handleCreate}
                      variant="primary"
                      className="px-8 py-3 text-lg"
                    >
                      开启修行
                    </InkButton>
                  </div>
                </>
              )}
            </div>
          </BookPage>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page-stack-container relative">
      {/* 
        渲染逻辑：
        1. 永远渲染 displayStep (当前底层最终页)
        2. 如果有 exitingStep (正在翻走的页)，渲染它在顶层并播放动画
      */}

      {/* 底层页面 (Next Page) - 静态 */}
      <div key={displayStep} className={cn('page-layer page-static')}>
        {renderStepContent(displayStep)}
      </div>

      {/* 顶层页面 (Exiting Page) - 翻页动画 */}
      {exitingStep && (
        <div key={exitingStep} className={cn('page-layer page-flipping')}>
          {renderStepContent(exitingStep)}
        </div>
      )}

      {/* 全局跳过按钮 (始终显示顶层) */}
      <button
        onClick={handleSkip}
        className="fixed top-4 right-4 z-50 text-sm text-amber-800/40 transition-colors hover:text-amber-800/70"
      >
        跳过开场 →
      </button>
    </div>
  );
}
