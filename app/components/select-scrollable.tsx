import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { MODEL_PRICING } from '~/lib/model-pricing';

interface SelectScrollableProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  enabledModels?: string[];
}

type ProviderGroup = {
  label: string;
  prefix: string[];
};

const providerGroups: ProviderGroup[] = [
  { label: 'OpenAI', prefix: ['gpt', 'o4'] },
  { label: 'Anthropic', prefix: ['claude'] },
  { label: 'Google Gemini', prefix: ['gemini'] },
];

const allModels = Object.values(MODEL_PRICING);

export const SelectScrollable = ({
  value,
  onChange,
  disabled,
  enabledModels,
}: SelectScrollableProps) => {
  const hasFilter = enabledModels && enabledModels.length > 0;

  // Check if current value is unavailable
  const isCurrentUnavailable =
    hasFilter && value && !enabledModels.includes(value);
  const currentModelName = value ? MODEL_PRICING[value]?.displayName : null;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select a model">
          {isCurrentUnavailable && currentModelName
            ? `${currentModelName} (unavailable)`
            : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {providerGroups.map((group) => {
          const groupModels = allModels.filter((m) =>
            group.prefix.some((p) => m.id.startsWith(p)),
          );

          const filteredModels = hasFilter
            ? groupModels.filter((m) => enabledModels.includes(m.id))
            : groupModels;

          if (filteredModels.length === 0) return null;

          return (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {filteredModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
};
