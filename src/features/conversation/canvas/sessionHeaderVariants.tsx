import { SessionHeaderVariantB as SessionHeaderVariantBComponent } from '../components/SessionHeaderVariantB';
import { SessionOverview, type SessionOverviewProps } from '../components/SessionOverview';
import { useSessionOverview } from '../hooks/useSessionOverview';
import type { CanvasContext } from './types';

interface SessionHeaderVariantProps {
  context: CanvasContext;
  label: string;
  HeaderComponent?: SessionOverviewProps['HeaderComponent'];
  toggleVariant?: SessionOverviewProps['toggleVariant'];
  showToggleCountsWhenOff?: SessionOverviewProps['showToggleCountsWhenOff'];
}

const getVariantHint = (hasSessionData: boolean) =>
  hasSessionData ? 'Loaded from session data' : 'Select a session to preview';

const SessionHeaderVariant = ({
  context,
  label,
  HeaderComponent,
  toggleVariant,
  showToggleCountsWhenOff,
}: SessionHeaderVariantProps) => {
  const {
    showThoughts,
    setShowThoughts,
    showTools,
    setShowTools,
    showMeta,
    setShowMeta,
    showFullContent,
    setShowFullContent,
    filteredTurns,
    visibleItemCount,
    stats,
  } = useSessionOverview(context.turns);

  return (
    <SessionOverview
      variantLabel={label}
      variantHint={getVariantHint(context.hasSessionData)}
      activeSession={context.activeSession}
      sessionDetails={context.sessionDetails}
      sessionsRoot={context.sessionsRoot}
      filteredTurns={filteredTurns}
      visibleItemCount={visibleItemCount}
      stats={stats}
      HeaderComponent={HeaderComponent}
      toggleVariant={toggleVariant}
      showToggleCountsWhenOff={showToggleCountsWhenOff}
      showThoughts={showThoughts}
      showTools={showTools}
      showMeta={showMeta}
      showFullContent={showFullContent}
      onShowThoughtsChange={setShowThoughts}
      onShowToolsChange={setShowTools}
      onShowMetaChange={setShowMeta}
      onShowFullContentChange={setShowFullContent}
    />
  );
};

export const SessionHeaderVariantA = ({ context }: { context: CanvasContext }) => (
  <SessionHeaderVariant context={context} label="Variant A" />
);

export const SessionHeaderVariantB = ({ context }: { context: CanvasContext }) => (
  <SessionHeaderVariant
    context={context}
    label="Variant B"
    HeaderComponent={SessionHeaderVariantBComponent}
    toggleVariant="compact"
    showToggleCountsWhenOff
  />
);
