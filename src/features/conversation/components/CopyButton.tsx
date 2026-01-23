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
    copiedIcon?: ReactNode;
    failedIcon?: ReactNode;
    duration?: number;
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
  copiedIcon,
  failedIcon,
  duration = 1500,
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
  const hasHoverLabel = resolvedHoverLabel !== null && resolvedHoverLabel !== false;
  const hasCopiedLabel = resolvedCopiedLabel !== null && resolvedCopiedLabel !== false;
  const hasFailedLabel = resolvedFailedLabel !== null && resolvedFailedLabel !== false;
  const hasCopiedIcon = resolvedCopiedIcon !== null && resolvedCopiedIcon !== false;
  const hasFailedIcon = resolvedFailedIcon !== null && resolvedFailedIcon !== false;
  const hasCopySource = Boolean(onCopy || typeof text === 'string' || getText);
  const isDisabled = disabled || !hasCopySource;
  const fallbackAriaLabel = typeof idleLabel === 'string' ? idleLabel : undefined;
  const resolvedAriaLabel = ariaLabel ?? fallbackAriaLabel;
  const buildInlineLabel = (label: ReactNode, icon?: ReactNode | null) =>
    icon ? (
      <span className="inline-flex items-center gap-1">
        {label}
        {icon}
      </span>
    ) : (
      label
    );
  const resolvedCopiedLabelNode = hasCopiedLabel
    ? buildInlineLabel(resolvedCopiedLabel, hasCopiedIcon ? resolvedCopiedIcon : null)
    : null;
  const resolvedFailedLabelNode = hasFailedLabel
    ? buildInlineLabel(resolvedFailedLabel, hasFailedIcon ? resolvedFailedIcon : null)
    : null;
  const resolvedHoverLabelNode = hasHoverLabel ? resolvedHoverLabel : null;
  const getLabelLength = (value: ReactNode, iconBonus = 0) => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).length + iconBonus;
    }
    return null;
  };
  const reserveCandidates: Array<{ node: ReactNode; length: number }> = [];
  const idleLength = getLabelLength(idleLabel);
  if (idleLength !== null) reserveCandidates.push({ node: idleLabel, length: idleLength });
  if (resolvedHoverLabelNode) {
    const hoverLength = getLabelLength(resolvedHoverLabelNode);
    if (hoverLength !== null) reserveCandidates.push({ node: resolvedHoverLabelNode, length: hoverLength });
  }
  if (resolvedCopiedLabelNode) {
    const copiedLength = getLabelLength(resolvedCopiedLabel, hasCopiedIcon ? 2 : 0);
    if (copiedLength !== null) reserveCandidates.push({ node: resolvedCopiedLabelNode, length: copiedLength });
  }
  if (resolvedFailedLabelNode) {
    const failedLength = getLabelLength(resolvedFailedLabel, hasFailedIcon ? 2 : 0);
    if (failedLength !== null) reserveCandidates.push({ node: resolvedFailedLabelNode, length: failedLength });
  }
  const autoReserveLabel = reserveCandidates.sort((a, b) => b.length - a.length)[0]?.node ?? idleLabel;
  const resolvedReserveLabel = reserveLabel ?? autoReserveLabel;

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

  const buttonClassName = ['group', className].filter(Boolean).join(' ');
  const contentWrapperClassName = 'inline-flex min-w-0 items-center gap-2';
  const leadingClassNameMerged = ['shrink-0', leadingClassName].filter(Boolean).join(' ');
  const labelWrapperClassNameMerged = ['relative inline-grid min-w-0', labelWrapperClassName].filter(Boolean).join(' ');
  const labelClassNameMerged = ['min-w-0 truncate', labelClassName].filter(Boolean).join(' ');
  const reserveLabelNode = (
    <span aria-hidden className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0`}>
      {resolvedReserveLabel}
    </span>
  );
  const labelStack = (
    <span className="absolute inset-0 grid">
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
      {resolvedCopiedLabelNode && (
        <span
          aria-hidden
          data-state={status}
          className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=copied]:opacity-100`}
        >
          {resolvedCopiedLabelNode}
        </span>
      )}
      {resolvedFailedLabelNode && (
        <span
          aria-hidden
          data-state={status}
          className={`${labelClassNameMerged} col-start-1 row-start-1 opacity-0 transition-opacity duration-150 data-[state=error]:opacity-100`}
        >
          {resolvedFailedLabelNode}
        </span>
      )}
    </span>
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
      <span className={contentWrapperClassName}>
        {leading && <span className={leadingClassNameMerged}>{leading}</span>}
        <span className={labelWrapperClassNameMerged}>
          {reserveLabelNode}
          {labelStack}
        </span>
      </span>
    </button>
  );
};
