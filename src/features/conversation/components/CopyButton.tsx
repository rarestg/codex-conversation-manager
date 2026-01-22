import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

type CopyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> & {
  onCopy: () => Promise<void> | void;
  children: ReactNode;
  copiedLabel?: ReactNode;
  duration?: number;
};

export const CopyButton = ({
  onCopy,
  children,
  copiedLabel,
  duration = 1500,
  disabled,
  ...buttonProps
}: CopyButtonProps) => {
  const { copiedId, showCopied } = useCopyFeedback();
  const copyId = 'copied';
  const isCopied = copiedId === copyId;

  const handleClick = async () => {
    if (disabled) return;
    await onCopy();
    showCopied(copyId, duration);
  };

  return (
    <button type="button" disabled={disabled} onClick={handleClick} {...buttonProps}>
      {isCopied ? (copiedLabel ?? 'Copied') : children}
    </button>
  );
};
