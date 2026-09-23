import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog-content dialog-${size}`}>
          <div className="dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description>{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface SheetProps extends ModalProps {
  side?: 'left' | 'right';
}

export function Sheet({ side = 'right', ...props }: SheetProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`sheet-content sheet-${side}`}>
          <div className="dialog-header">
            <div>
              <Dialog.Title>{props.title}</Dialog.Title>
              {props.description ? (
                <Dialog.Description>{props.description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close panel">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
