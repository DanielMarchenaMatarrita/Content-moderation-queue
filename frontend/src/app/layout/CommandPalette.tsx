import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { FilePlus, MagnifyingGlass, UserPlus, X } from '@phosphor-icons/react';
import {
  navigationItems,
  type NavigationItem,
} from '../../shared/config/navigation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionCommands: NavigationItem[] = [
  { label: 'Submit content', to: '/contents/new', icon: FilePlus },
  { label: 'Create user', to: '/users/new', icon: UserPlus },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const commands = [...navigationItems, ...actionCommands].filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase().trim()),
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  function run(to: string) {
    navigate(to);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="command-dialog"
          aria-describedby="command-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description id="command-description" className="sr-only">
            Search application navigation and actions.
          </Dialog.Description>
          <div className="command-search">
            <MagnifyingGlass size={19} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search navigation and actions"
              aria-label="Search commands"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="command-results"
              aria-activedescendant={commands[activeIndex] ? `command-${activeIndex}` : undefined}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, commands.length - 1));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                }
                if (event.key === 'Enter' && commands[activeIndex]) {
                  event.preventDefault();
                  run(commands[activeIndex].to);
                }
              }}
            />
            <Dialog.Close className="icon-button" aria-label="Close command palette">
              <X size={17} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div id="command-results" className="command-results" role="listbox" aria-label="Commands">
            {commands.length ? (
              commands.map((command, index) => {
                const Icon = command.icon;
                return (
                  <button
                    id={`command-${index}`}
                    key={`${command.label}-${command.to}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    className={`command-item${index === activeIndex ? ' command-item-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => run(command.to)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{command.label}</span>
                    <kbd>Enter</kbd>
                  </button>
                );
              })
            ) : (
              <p className="command-empty">No matching commands</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
