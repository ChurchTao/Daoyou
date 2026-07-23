import { describe, expect, it, vi } from 'vitest';
import {
  buildNodeActions,
  buildSectLandmarkActions,
  resolveMapIntent,
} from './mapActions';

describe('world map actions', () => {
  it('resolves the sect intent and suppresses ordinary node actions', () => {
    expect(resolveMapIntent('sect')).toBe('sect');
    expect(
      buildNodeActions(
        'sect',
        {
          selectedNodeId: 'SAT_TN_01',
          isMainNode: false,
          marketEnabled: false,
        },
        vi.fn(),
      ),
    ).toEqual([]);
  });

  it('only offers entry for the active sect landmark', () => {
    const navigate = vi.fn();
    const actions = buildSectLandmarkActions('lingxiao', 'lingxiao', navigate);

    expect(actions.map((action) => action.label)).toEqual(['进入宗门']);
    actions[0]?.onClick();
    expect(navigate).toHaveBeenCalledWith('/game/sect');
  });

  it('offers introduction and visiting for another sect', () => {
    const navigate = vi.fn();
    const actions = buildSectLandmarkActions('youdu', 'lingxiao', navigate);

    expect(actions.map((action) => action.label)).toEqual([
      '查看介绍',
      '拜访山门',
    ]);
    actions[0]?.onClick();
    actions[1]?.onClick();
    expect(navigate).toHaveBeenNthCalledWith(
      1,
      '/game/sect/onboarding?sectId=youdu',
    );
    expect(navigate).toHaveBeenNthCalledWith(2, '/game/sect/youdu/visit');
  });

  it('offers the same visitor actions before joining a sect', () => {
    const actions = buildSectLandmarkActions('youdu', null, vi.fn());

    expect(actions.map((action) => action.label)).toEqual([
      '查看介绍',
      '拜访山门',
    ]);
  });
});
