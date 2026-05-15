// src/store/use-ui-store.ts
import { create } from 'zustand';

interface UIState {
  openSheetsCount: number;
  incrementSheets: () => void;
  decrementSheets: () => void;
  isAnySheetOpen: () => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  openSheetsCount: 0,
  incrementSheets: () => set((state) => ({ openSheetsCount: state.openSheetsCount + 1 })),
  decrementSheets: () => set((state) => ({ openSheetsCount: Math.max(0, state.openSheetsCount - 1) })),
  isAnySheetOpen: () => get().openSheetsCount > 0,
}));
