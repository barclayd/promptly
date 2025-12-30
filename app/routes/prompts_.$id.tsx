import { NavLink } from 'react-router';
import { Paper } from '~/components/ui/paper';
import type { Route } from './+types/prompts_.$id';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content: 'The CMS for building AI at scale',
    },
  ];
}

export default function Prompts() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-gray-200">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <NavLink to="/prompts/1/1">
              <Paper className="items-start">
                <div className="flex flex-wrap text-pretty flex-col gap-y-2 p-4">
                  <div className="flex flex-col gap-y-1 mb-4 select-none">
                    <div className="text-[0.5rem] text-right text-gray-400">
                      <span className="text-black">Last updated:</span>
                      <br />
                      {new Date().toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                    <div className="text-[0.5rem] text-right text-gray-400">
                      <span className="text-black">Last authored:</span>
                      <br />
                      Alex S
                    </div>
                  </div>
                  <h3 className="text-sm font-bold">Reviews</h3>
                  <p className="text-xs">
                    Selects and modifies a customer review that will most likely
                    lead to an uplift in conversion
                  </p>
                </div>
              </Paper>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
