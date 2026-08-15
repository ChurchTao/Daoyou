import { sanitizeBlackMarketObservationText } from './blackMarketObservations';

describe('black market observations', () => {
  it('removes exact identity, quality and price language', () => {
    expect(
      sanitizeBlackMarketObservationText(
        '九转蕴灵草像是天品，约值12,000灵石。',
        '九转蕴灵草',
      ),
    ).not.toMatch(/九转蕴灵草|天品|12,000/);
  });
});
