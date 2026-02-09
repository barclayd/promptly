'use client';

import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  clearOnboardingProgress,
  setOnboardingPromptId,
  setOnboardingStep,
} from '~/hooks/use-onboarding-progress';
import {
  getInputData,
  getPromptDescription,
  getPromptName,
  getSchemaFields,
  SYSTEM_MESSAGE,
  USER_MESSAGE,
} from '~/lib/onboarding-actions';
import { ONBOARDING_TOUR_NAME } from '~/lib/onboarding-steps';
import { useOnboardingStore } from '~/stores/onboarding-store';
import { usePromptEditorStore } from '~/stores/prompt-editor-store';

// markOnboardingCompleted/Skipped are called from the provider, not here

/**
 * Wait for the prompt editor store to be initialized, then fill it with
 * onboarding content (system message, user message, schema, test config).
 * Extracted as a standalone async function so it can be called from both
 * the `onStepChange(4)` callback AND explicitly from step 3 (since
 * `setCurrentStep` does NOT trigger `onStepChange`).
 */
export const fillPromptEditor = async (firstName: string) => {
  // Wait for prompt editor store to initialize
  await new Promise<void>((resolve) => {
    const check = () => {
      if (usePromptEditorStore.getState()._initialized) {
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });

  // Small extra delay for DOM to be ready
  await new Promise((r) => setTimeout(r, 400));

  const editorStore = usePromptEditorStore.getState();
  const schemaFields = getSchemaFields();
  editorStore.setSchemaFields(schemaFields);
  editorStore.setSystemMessage(SYSTEM_MESSAGE);
  editorStore.setUserMessage(USER_MESSAGE);
  editorStore.setTestModel('claude-haiku-4.5');
  editorStore.setTestTemperature(0.7);
  editorStore.setInputData(getInputData(firstName));

  // Persist config to DB
  const promptId = useOnboardingStore.getState().createdPromptId;
  if (promptId) {
    const config = {
      schema: schemaFields,
      model: editorStore.model,
      temperature: editorStore.temperature,
      inputData: getInputData(firstName),
      inputDataRootName: null,
    };

    // Save messages
    const msgFormData = new FormData();
    msgFormData.append('intent', 'saveMessages');
    msgFormData.append('systemMessage', SYSTEM_MESSAGE);
    msgFormData.append('userMessage', USER_MESSAGE);
    fetch(`/prompts/${promptId}`, {
      method: 'POST',
      body: msgFormData,
    }).catch(() => {});

    // Save config
    const configFormData = new FormData();
    configFormData.append('intent', 'saveConfig');
    configFormData.append('config', JSON.stringify(config));
    fetch(`/prompts/${promptId}`, {
      method: 'POST',
      body: configFormData,
    }).catch(() => {});
  }
};

export const useOnboardingOrchestrator = (
  setCurrentStep?: (step: number, delay?: number) => void,
  userId?: string | null,
) => {
  const navigate = useNavigate();
  const processingRef = useRef(false);

  const onStepChange = useCallback(
    async (step: number, tourName: string | null) => {
      if (tourName !== ONBOARDING_TOUR_NAME) return;

      // Persist progress
      if (userId) setOnboardingStep(userId, step);

      const store = useOnboardingStore.getState();

      if (step === 1) {
        // Step 1: Open create dialog by clicking the create button
        const btn = document.getElementById('onboarding-create-button');
        if (btn) btn.click();
      }

      if (step === 2) {
        // Step 2: Pre-fill the dialog inputs
        const firstName = store.userName ?? 'there';
        requestAnimationFrame(() => {
          const nameInput = document.getElementById(
            'prompt',
          ) as HTMLInputElement | null;
          const descInput = document.getElementById(
            'description',
          ) as HTMLTextAreaElement | null;
          if (nameInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value',
            )?.set;
            nativeSetter?.call(nameInput, getPromptName(firstName));
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (descInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype,
              'value',
            )?.set;
            nativeSetter?.call(descInput, getPromptDescription(firstName));
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      if (step === 3 && !processingRef.current) {
        // Step 3: Submit form via fetch, capture promptId, navigate
        processingRef.current = true;
        const firstName = store.userName ?? 'there';
        try {
          const formData = new FormData();
          formData.append('name', getPromptName(firstName));
          formData.append('description', getPromptDescription(firstName));

          const response = await fetch('/api/prompts/create', {
            method: 'POST',
            body: formData,
            redirect: 'follow',
          });

          if (!response.ok) {
            throw new Error(`Failed to create prompt: ${response.status}`);
          }

          // Extract promptId from the final URL after redirect
          const finalUrl = response.url;
          const promptId = finalUrl.split('/prompts/').pop();
          if (!promptId) throw new Error('Could not extract prompt ID');

          useOnboardingStore.getState().setCreatedPromptId(promptId);
          if (userId) setOnboardingPromptId(userId, promptId);
          navigate(`/prompts/${promptId}`);

          // Auto-advance to step 4 after navigation.
          // Note: setCurrentStep only updates the tour UI — it does NOT trigger
          // onStepChange, so we must also run fillPromptEditor explicitly.
          if (setCurrentStep) {
            setTimeout(() => {
              setCurrentStep(4);
              fillPromptEditor(firstName);
            }, 1000);
          }
        } catch {
          toast.error('Failed to create prompt. Please try again.');
          useOnboardingStore.getState().reset();
        } finally {
          processingRef.current = false;
        }
      }

      if (step === 4) {
        // Step 4: Wait for prompt editor to initialize, then set content
        const firstName = store.userName ?? 'there';
        await fillPromptEditor(firstName);
      }

      if (step === 5) {
        // Step 5: Scroll User Prompt textarea into view then force overlay
        // recalculation.  NextStepjs calculates spotlight position before its
        // own scrollIntoView animation finishes, so the cutout ends up at the
        // pre-scroll coordinates.  A deferred resize event forces recalc.
        const userPrompt = document.getElementById('textarea-user-prompt');
        if (userPrompt) {
          userPrompt.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 600);
        }
      }

      if (step === 6) {
        // Step 6: Open test collapsible by clicking the trigger
        const testSection = document.getElementById('onboarding-test-section');
        if (testSection) {
          // Target specifically the CollapsibleTrigger, not any [data-state] element
          const collapsible = testSection.querySelector(
            '[data-slot="collapsible"]',
          );
          const isClosed = collapsible?.getAttribute('data-state') === 'closed';
          if (isClosed) {
            const trigger = testSection.querySelector(
              '[data-slot="collapsible-trigger"]',
            ) as HTMLElement | null;
            if (trigger) trigger.click();
          }

          // Scroll into view, then force overlay recalculation after scroll
          // and collapsible animation settle
          setTimeout(() => {
            testSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 500);
          }, 300);
        }
      }

      // Step 9 (completion) is handled by onComplete callback in the provider
    },
    [navigate, setCurrentStep, userId],
  );

  const onComplete = useCallback(
    (tourName: string | null) => {
      if (tourName !== ONBOARDING_TOUR_NAME) return;
      const store = useOnboardingStore.getState();
      store.reset();
      if (userId) clearOnboardingProgress(userId);
    },
    [userId],
  );

  const onSkip = useCallback((_step: number, tourName: string | null) => {
    if (tourName !== ONBOARDING_TOUR_NAME) return;
    useOnboardingStore.getState().reset();
    // Close the create dialog if open
    const dialog = document.getElementById('onboarding-create-dialog');
    if (dialog) {
      const closeBtn = dialog.querySelector(
        '[data-slot="dialog-close"]',
      ) as HTMLElement | null;
      closeBtn?.click();
    }
  }, []);

  return { onStepChange, onComplete, onSkip };
};
