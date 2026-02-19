import { create } from 'zustand';

type OnboardingState = {
  isActive: boolean;
  createdPromptId: string | null;
  userName: string | null;
  isCreatingPrompt: boolean;
};

type OnboardingActions = {
  start: (userName: string | null) => void;
  setCreatedPromptId: (id: string) => void;
  setIsCreatingPrompt: (v: boolean) => void;
  reset: () => void;
};

type OnboardingStore = OnboardingState & OnboardingActions;

const initialState: OnboardingState = {
  isActive: false,
  createdPromptId: null,
  userName: null,
  isCreatingPrompt: false,
};

export const useOnboardingStore = create<OnboardingStore>()((set) => ({
  ...initialState,
  start: (userName) => set({ isActive: true, userName }),
  setCreatedPromptId: (id) => set({ createdPromptId: id }),
  setIsCreatingPrompt: (v) => set({ isCreatingPrompt: v }),
  reset: () => set(initialState),
}));
