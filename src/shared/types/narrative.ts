export type NarrativeTone = 'mist' | 'steel' | 'ember' | 'stillness';

export interface NarrativeAct {
  id: string;
  title: string;
  scene: string;
  body: string;
  speaker?: string;
  backgroundPosition?: string;
  tone?: NarrativeTone;
}

export interface NarrativePerformanceScript {
  id: string;
  title: string;
  theme: NarrativeTone;
  backdrop: {
    src: string;
    alt: string;
  };
  acts: readonly [NarrativeAct, ...NarrativeAct[]];
}
