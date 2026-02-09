import type { Tour } from 'nextstepjs';

export const ONBOARDING_TOUR_NAME = 'onboarding';

export const onboardingTour: Tour = {
  tour: ONBOARDING_TOUR_NAME,
  steps: [
    {
      // Step 0: Welcome card (centered, no selector)
      icon: '👋',
      title: 'Welcome to Promptly!',
      content:
        "Let's create your first prompt together — it only takes about 2 minutes. We'll write a prompt, configure it with variables, and run a live test.",
      showControls: true,
      showSkip: true,
      pointerPadding: 0,
      pointerRadius: 0,
    },
    {
      // Step 1: Highlight Create button
      icon: '✨',
      title: 'Create your first prompt',
      content:
        "This is where all new prompts begin. Click Next and we'll create one for you.",
      selector: '#onboarding-create-button',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 10,
    },
    {
      // Step 2: Highlight pre-filled dialog
      icon: '📝',
      title: "We've filled this in for you",
      content:
        "We've added a name and description for your first prompt. Click Next to create it.",
      selector: '#onboarding-create-dialog',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 12,
      pointerRadius: 16,
    },
    {
      // Step 3: Creating prompt overlay
      icon: '🚀',
      title: 'Creating your prompt...',
      content: "Hang tight — we're setting everything up for you.",
      showControls: false,
      showSkip: false,
      blockKeyboardControl: true,
      pointerPadding: 0,
      pointerRadius: 0,
    },
    {
      // Step 4: Highlight System Prompt
      icon: '🧠',
      title: 'System Prompt',
      content:
        "This is where you define how your AI should behave. We've pre-filled it with instructions for a personalised welcome message.",
      selector: '#textarea-system-prompt',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 10,
    },
    {
      // Step 5: Highlight User Prompt
      icon: '💬',
      title: 'User Prompt',
      content:
        'This is the message sent to the AI each time. Notice the variables in curly braces — they get replaced with real data at runtime.',
      selector: '#textarea-user-prompt',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 10,
    },
    {
      // Step 6: Highlight Test section
      icon: '🧪',
      title: 'Test your prompt',
      content:
        "The test panel lets you try your prompt with real data before publishing. We've set up test values for you — click Next, then hit the Test button.",
      selector: '#onboarding-test-section',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      // Step 7: Highlight Test button (user clicks it)
      icon: '▶️',
      title: 'Hit the Test button!',
      content:
        'Go ahead — click the Test button to run your prompt and see the AI respond in real time.',
      selector: '#onboarding-test-button',
      side: 'left',
      showControls: false,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 10,
      blockKeyboardControl: true,
    },
    {
      // Step 8: Highlight streaming response
      icon: '✅',
      title: 'Your prompt in action!',
      content:
        "That's your AI responding in real time. Every prompt you create can be tested like this before going live.",
      selector: '#onboarding-test-response',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 10,
    },
    {
      // Step 9: Final CTA
      icon: '🎉',
      title: "You're all set!",
      content:
        "You've just created, configured, and tested your first prompt. Head to Settings to finish setting up your account, or explore on your own.",
      showControls: true,
      showSkip: true,
      pointerPadding: 0,
      pointerRadius: 0,
    },
  ],
};
