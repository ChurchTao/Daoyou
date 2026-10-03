import { useContext } from 'react';
import { InkUIContext } from './inkUIContext';

export function useInkUI() {
  const context = useContext(InkUIContext);
  if (!context) {
    throw new Error('useInkUI must be used within InkUIProvider');
  }
  return context;
}
