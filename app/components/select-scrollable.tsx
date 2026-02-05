import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface SelectScrollableProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export const SelectScrollable = ({
  value,
  onChange,
  disabled,
}: SelectScrollableProps) => {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>OpenAI</SelectLabel>
          <SelectItem value="gpt-5.2-pro">GPT-5.2 Pro</SelectItem>
          <SelectItem value="gpt-5.2-thinking">GPT-5.2 Thinking</SelectItem>
          <SelectItem value="gpt-5.2-instant">GPT-5.2 Instant</SelectItem>
          <SelectItem value="gpt-5.2-codex">GPT-5.2 Codex</SelectItem>
          <SelectItem value="gpt-5.1-codex-max">GPT-5.1 Codex Max</SelectItem>
          <SelectItem value="gpt-5-codex-mini">GPT-5 Codex Mini</SelectItem>
          <SelectItem value="o4-mini">o4-mini</SelectItem>
          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Anthropic</SelectLabel>
          <SelectItem value="claude-opus-4.6">Claude Opus 4.6</SelectItem>
          <SelectItem value="claude-sonnet-4.5">Claude Sonnet 4.5</SelectItem>
          <SelectItem value="claude-haiku-4.5">Claude Haiku 4.5</SelectItem>
          <SelectItem value="claude-opus-4.1">Claude Opus 4.1</SelectItem>
          <SelectItem value="claude-opus-4">Claude Opus 4</SelectItem>
          <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
          <SelectItem value="claude-3.7-sonnet">Claude 3.7 Sonnet</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Google Gemini</SelectLabel>
          <SelectItem value="gemini-3-pro">Gemini 3 Pro</SelectItem>
          <SelectItem value="gemini-3-flash">Gemini 3 Flash</SelectItem>
          <SelectItem value="gemini-3-deep-think">
            Gemini 3 Deep Think
          </SelectItem>
          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
