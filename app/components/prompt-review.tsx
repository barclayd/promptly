import { IconCopy, IconCornerDownLeft } from '@tabler/icons-react';
import { Save } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '~/components/ui/input-group';

export const PromptReview = ({
  title,
  input,
}: {
  title: string;
  input?: string;
}) => {
  return (
    <div className="grid w-full gap-4">
      <InputGroup>
        <InputGroupTextarea
          id="textarea-code-32"
          placeholder="console.log('Hello, world!');"
          className="min-h-[200px]"
          defaultValue={input}
        />
        <InputGroupAddon align="block-end" className="border-t">
          <InputGroupText>
            Last updated:
            <span className="italic text-gray-400">
              {new Date().toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </InputGroupText>
          <InputGroupButton size="sm" className="ml-auto" variant="default">
            Run <IconCornerDownLeft />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupAddon align="block-start" className="border-b">
          <InputGroupText className="font-mono font-medium">
            {title}
          </InputGroupText>
          <div className="grow" />
          <InputGroupButton variant="ghost" size="icon-xs">
            <Save />
          </InputGroupButton>
          <InputGroupButton variant="ghost" size="icon-xs">
            <IconCopy />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};
