'use client';

import {
  IconBrain,
  IconBrandGoogle,
  IconBrandOpenai,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconKey,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useFetcher } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { getModelsByProvider, type Provider } from '~/lib/model-pricing';
import { cn } from '~/lib/utils';

type ActionData = {
  success?: boolean;
  errors?: Record<string, string[]>;
};

const providerOptions = [
  {
    value: 'openai' as const,
    label: 'OpenAI',
    icon: IconBrandOpenai,
  },
  {
    value: 'anthropic' as const,
    label: 'Anthropic',
    icon: IconBrain,
  },
  {
    value: 'google' as const,
    label: 'Google AI',
    icon: IconBrandGoogle,
  },
];

interface CreateLlmApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateLlmApiKeyDialog = ({
  open,
  onOpenChange,
}: CreateLlmApiKeyDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const [provider, setProvider] = useState<Provider | ''>('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelsPopoverOpen, setModelsPopoverOpen] = useState(false);

  const isSubmitting = fetcher.state === 'submitting';
  const errors = fetcher.data?.errors;

  const availableModels = provider ? getModelsByProvider(provider) : [];

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value as Provider);
    setSelectedModels([]);
  }, []);

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : [...prev, modelId],
    );
  }, []);

  const removeModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => prev.filter((m) => m !== modelId));
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedModels.length === availableModels.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(availableModels.map((m) => m.id));
    }
  }, [selectedModels.length, availableModels]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setProvider('');
      setSelectedModels([]);
      setShowApiKey(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('enabledModels', JSON.stringify(selectedModels));
    fetcher.submit(formData, {
      method: 'post',
      action: '/api/settings/create-llm-api-key',
    });
  };

  // Close dialog on successful creation
  if (fetcher.data?.success && open) {
    // Use setTimeout to avoid React state update during render
    setTimeout(() => handleOpenChange(false), 0);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <IconKey className="size-4 text-muted-foreground" />
              </div>
              Add LLM API Key
            </DialogTitle>
            <DialogDescription>
              Connect an AI provider to test your prompts against their models.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="llm-key-name" className="text-sm font-medium">
                Name
              </Label>
              <Input
                id="llm-key-name"
                name="name"
                placeholder="e.g. Production OpenAI Key"
                className="h-10"
              />
              {errors?.name && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.name[0]}
                </p>
              )}
            </div>

            {/* Provider */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Provider</Label>
              <Select
                name="provider"
                value={provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="size-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.provider && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.provider[0]}
                </p>
              )}
            </div>

            {/* Models multi-select */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Models</Label>
              <Popover
                open={modelsPopoverOpen}
                onOpenChange={setModelsPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={modelsPopoverOpen}
                    className="h-auto min-h-10 w-full justify-between font-normal"
                    disabled={!provider}
                  >
                    {selectedModels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedModels.map((modelId) => {
                          const model = availableModels.find(
                            (m) => m.id === modelId,
                          );
                          return (
                            <Badge
                              key={modelId}
                              variant="secondary"
                              className="text-xs gap-1"
                            >
                              {model?.displayName ?? modelId}
                              <button
                                type="button"
                                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeModel(modelId);
                                }}
                              >
                                <IconX className="size-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {provider
                          ? 'Select models...'
                          : 'Choose a provider first'}
                      </span>
                    )}
                    <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search models..." />
                    <CommandList>
                      <CommandEmpty>No models found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={handleSelectAll}>
                          <IconCheck
                            className={cn(
                              'mr-2 size-4',
                              selectedModels.length === availableModels.length
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                          Select all
                        </CommandItem>
                        {availableModels.map((model) => (
                          <CommandItem
                            key={model.id}
                            value={model.displayName}
                            onSelect={() => toggleModel(model.id)}
                          >
                            <IconCheck
                              className={cn(
                                'mr-2 size-4',
                                selectedModels.includes(model.id)
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            {model.displayName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors?.enabledModels && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.enabledModels[0]}
                </p>
              )}
            </div>

            {/* API Key */}
            <div className="grid gap-2">
              <Label htmlFor="llm-api-key" className="text-sm font-medium">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="llm-api-key"
                  name="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <IconEyeOff className="size-4" />
                  ) : (
                    <IconEye className="size-4" />
                  )}
                </button>
              </div>
              {errors?.apiKey && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.apiKey[0]}
                </p>
              )}
            </div>

            {errors?._form && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm">{errors._form[0]}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => handleOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedModels.length === 0}
              className="min-w-[140px] transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconKey className="size-4" />
                  Add API Key
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
