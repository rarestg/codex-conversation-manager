import { Check, X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { copyText } from '../copy';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

type CopySource =
  | { onCopy: () => Promise<boolean | undefined> | boolean | undefined; text?: never; getText?: never }
  | { text: string; onCopy?: never; getText?: never }
  | { getText: () => string | Promise<string>; onCopy?: never; text?: never };

type CopyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'children'> &
  CopySource & {
    idleLabel: ReactNode;
    hoverLabel?: ReactNode | null;
    copiedLabel?: ReactNode;
    failedLabel?: ReactNode;
    reserveLabel?: ReactNode;
    leading?: ReactNode;
    leadingClassName?: string;
    labelClassName?: string;
    labelWrapperClassName?: string;
    rightIcon?: ReactNode;
    copiedIcon?: ReactNode;
    failedIcon?: ReactNode;
    iconClassName?: string;
    duration?: number;
    centerLabel?: boolean;
    ariaLabel?: string;
    copiedAnnouncement?: string;
    failedAnnouncement?: string;
  };

export const CopyButton = ({
  onCopy,
  text,
  getText,
  idleLabel,
  hoverLabel,
  copiedLabel,
  failedLabel,
  reserveLabel,
  leading,
  leadingClassName,
  labelClassName,
  labelWrapperClassName,
  rightIcon,
  copiedIcon,
  failedIcon,
  iconClassName,
  duration = 1500,
  centerLabel = false,
  ariaLabel,
  copiedAnnouncement = 'Copied!',
  failedAnnouncement = 'Copy failed.',
  disabled,
  className,
  ...buttonProps
}: CopyButtonProps) => {
  const { status, message, showFeedback } = useCopyFeedback();
  const resolvedHoverLabel = hoverLabel === undefined ? 'Copy' : hoverLabel;
  const resolvedCopiedLabel = copiedLabel === undefined ? 'Copied!' : copiedLabel;
  const resolvedFailedLabel = failedLabel === undefined ? 'Copy failed' : failedLabel;
  const resolvedCopiedIcon = copiedIcon === undefined ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : copiedIcon;
  const resolvedFailedIcon = failedIcon === undefined ? <X className="h-3.5 w-3.5 text-rose-500" /> : failedIcon;
  const resolvedReserveLabel = reserveLabel ?? idleLabel;
  const hasHoverLabel = resolvedHoverLabel !== null && resolvedHoverLabel !== false;
  const hasCopiedLabel = resolvedCopiedLabel !== null && resolvedCopiedLabel !== false;
  const hasFailedLabel = resolvedFailedLabel !== null && resolvedFailedLabel !== false;
  const hasCopiedIcon = resolvedCopiedIcon !== null && resolvedCopiedIcon !== false;
  const hasFailedIcon = resolvedFailedIcon !== null && resolvedFailedIcon !== false;
  const hasIcon = Boolean(rightIcon || hasCopiedIcon || hasFailedIcon);
  const hasCopySource = Boolean(onCopy || typeof text === 'string' || getText);
  const isDisabled = disabled || !hasCopySource;
  const fallbackAriaLabel = typeof idleLabel === 'string' ? idleLabel : undefined;
  const resolvedAriaLabel = ariaLabel ?? fallbackAriaLabel;

  const handleClick = async () => {
    if (isDisabled) return;
    let didCopy = false;
    try {
      if (onCopy) {
        const result = await onCopy();
        didCopy = result !== false;
        if (import.meta.env.DEV && result === false) {
          console.warn('CopyButton: onCopy returned false', {
            ariaLabel: resolvedAriaLabel,
          });
        }
      } else if (typeof text === 'string') {
        didCopy = await copyText(text);
      } else if (getText) {
        const resolvedText = await getText();
        didCopy = await copyText(resolvedText);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      didCopy = false;
    }

    if (didCopy) {
      showFeedback('copied', copiedAnnouncement, duration);
    } else {
      showFeedback('error', failedAnnouncement, duration);
    }
  };

  const buttonClassName = ['group', centerLabel ? 'relative' : null, className].filter(Boolean).join(' ');
  const leadingClassNameMerged = ['shrink-0', leadingClassName].filter(Boolean).join(' ');
  const labelWrapperClassNameMerged = ['relative inline-grid min-w-0', labelWrapperClassName].filter(Boolean).join(' ');
  const overlayLabelWrapperClassNameMerged = [
    'relative inline-grid min-w-0 w-full justify-items-center',
    labelWrapperClassName,
  ]
    .filter(Boolean)
    .join(' ');
  const labelClassNameMerged = ['min-w-0 truncate', labelClassName].filter(Boolean).join(' ');
  const iconClassNameMerged = ['relative inline-grid h-4 w-4 items-center justify-center', iconClassName]
    .filter(Boolean)
    .join(' ');
  const reserveLabelNode = (
    <span aria-hidden className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0`}>
      {resolvedReserveLabel}
    </span>
  );
  const labelStack = (
    <>
      <span
        aria-hidden
        data-state={status}
        className={`${labelClassNameMerged} col-start-1 row-start-1 transition-opacity duration-150 data-[state=copied]:opacity-0 data-[state=error]:opacity-0 ${
          hasHoverLabel ? 'group-hover:opacity-0 group-focus-visible:opacity-0' : ''
        }`}
      >
        {idleLabel}
      </span>
      {hasHoverLabel && (
        <span
          aria-hidden
          data-state={status}
          className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=copied]:opacity-0 data-[state=error]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100`}
        >
          {resolvedHoverLabel}
        </span>
      )}
      {hasCopiedLabel && (
        <span
          aria-hidden
          data-state={status}
          className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=copied]:opacity-100`}
        >
          {resolvedCopiedLabel}
        </span>
      )}
      {hasFailedLabel && (
        <span
          aria-hidden
          data-state={status}
          className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=error]:opacity-100`}
        >
          {resolvedFailedLabel}
        </span>
      )}
    </>
  );

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={resolvedAriaLabel}
      onClick={handleClick}
      className={buttonClassName}
      {...buttonProps}
    >
      <output aria-live="polite" className="sr-only">
        {message ?? ''}
      </output>
      <span className="inline-flex min-w-0 items-center gap-2">
        {leading && <span className={leadingClassNameMerged}>{leading}</span>}
        {centerLabel ? (
          <span className={labelWrapperClassNameMerged}>{reserveLabelNode}</span>
        ) : (
          <span className={labelWrapperClassNameMerged}>
            {reserveLabelNode}
            {labelStack}
          </span>
        )}
        {hasIcon && (
          <span className={iconClassNameMerged}>
            {rightIcon && (
              <span
                aria-hidden
                data-state={status}
                className="col-start-1 row-start-1 transition-opacity duration-150 data-[state=copied]:opacity-0 data-[state=error]:opacity-0"
              >
                {rightIcon}
              </span>
            )}
            {hasCopiedIcon && (
              <span
                aria-hidden
                data-state={status}
                className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=copied]:opacity-100"
              >
                {resolvedCopiedIcon}
              </span>
            )}
            {hasFailedIcon && (
              <span
                aria-hidden
                data-state={status}
                className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=error]:opacity-100"
              >
                {resolvedFailedIcon}
              </span>
            )}
          </span>
        )}
      </span>
      {centerLabel && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className={overlayLabelWrapperClassNameMerged}>{labelStack}</span>
        </span>
      )}
    </button>
  );
};
