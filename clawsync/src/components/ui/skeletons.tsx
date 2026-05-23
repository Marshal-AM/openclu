import { Skeleton } from './Skeleton';
import '../syncboard/PremiumSkillCard.css';

export function SkillCardSkeleton() {
  return (
    <div className="skeleton-skill-card">
      <div className="skeleton-skill-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton style={{ height: '1rem', width: '62%', marginBottom: '0.5rem' }} />
          <Skeleton style={{ height: '0.75rem', width: '42%' }} />
        </div>
        <Skeleton style={{ height: '0.875rem', width: '3.5rem', flexShrink: 0 }} />
      </div>
      <div className="skeleton-skill-card-body">
        <Skeleton style={{ height: '168px', width: '100%', borderRadius: 'var(--radius-lg)' }} />
      </div>
      <div className="skeleton-skill-card-footer">
        <Skeleton style={{ height: '0.75rem', width: '38%' }} />
      </div>
    </div>
  );
}

export function SkillCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="premium-skill-grid">
      {Array.from({ length: count }).map((_, index) => (
        <SkillCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="skeleton-agent-card">
      <div className="skeleton-agent-card-header">
        <Skeleton style={{ height: '1rem', width: '55%' }} />
        <Skeleton style={{ height: '1.25rem', width: '4rem', borderRadius: 'var(--radius-full)' }} />
      </div>
      <div className="skeleton-agent-card-body">
        <Skeleton style={{ height: '0.75rem', width: '80%' }} />
        <Skeleton style={{ height: '0.75rem', width: '60%' }} />
      </div>
      <div className="skeleton-agent-card-footer">
        <Skeleton style={{ height: '0.75rem', width: '45%' }} />
      </div>
    </div>
  );
}

export function AgentCardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-3)',
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <AgentCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function DetailPanelGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-detail-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-detail-panel">
          <Skeleton style={{ height: '0.75rem', width: '48%' }} />
          <Skeleton style={{ height: '1rem', width: '88%', marginTop: '0.75rem' }} />
        </div>
      ))}
    </div>
  );
}

export function SkillDetailHeaderSkeleton() {
  return (
    <div className="skeleton-detail-card">
      <div className="skeleton-detail-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton style={{ height: '1.75rem', width: '40%' }} />
          <Skeleton style={{ height: '0.875rem', width: '28%', marginTop: '0.5rem' }} />
        </div>
        <Skeleton style={{ height: '0.875rem', width: '3.5rem' }} />
      </div>
      <div className="skeleton-detail-meta-list">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index}>
            <Skeleton style={{ height: '0.75rem', width: '20%' }} />
            <Skeleton style={{ height: '0.875rem', width: '55%', marginTop: '0.5rem' }} />
          </div>
        ))}
      </div>
      <Skeleton style={{ height: '2rem', width: '6.5rem', marginTop: '0.25rem' }} />
    </div>
  );
}

export function MarkdownBlockSkeleton() {
  return (
    <div>
      <Skeleton style={{ height: '0.75rem', width: '8rem', marginBottom: '0.75rem' }} />
      <Skeleton style={{ height: '420px', width: '100%', borderRadius: 'var(--radius-lg)' }} />
    </div>
  );
}

export function SkillDetailPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <SkillDetailHeaderSkeleton />
      <MarkdownBlockSkeleton />
    </div>
  );
}

export function CatalogDetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <Skeleton style={{ height: '0.75rem', width: '5rem' }} />
      <Skeleton style={{ height: '1rem', width: '100%' }} />
      <Skeleton style={{ height: '1rem', width: '88%' }} />
      <Skeleton style={{ height: '0.75rem', width: '3rem' }} />
      <Skeleton style={{ height: '1.5rem', width: '55%' }} />
      <Skeleton style={{ height: '2.75rem', width: '30%', minWidth: '7rem', borderRadius: '9999px' }} />
    </div>
  );
}

export function FeedItemSkeleton() {
  return (
    <div className="skeleton-feed-item">
      <Skeleton style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Skeleton style={{ height: '0.875rem', width: '85%' }} />
        <Skeleton style={{ height: '0.75rem', width: '30%', marginTop: '0.5rem' }} />
      </div>
    </div>
  );
}

export function FeedListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-feed-list">
      {Array.from({ length: count }).map((_, index) => (
        <FeedItemSkeleton key={index} />
      ))}
    </div>
  );
}

export function ChipRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-chip-row">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          style={{ height: '1.75rem', width: index === 0 ? '3rem' : '5.5rem', borderRadius: 'var(--radius-full)' }}
        />
      ))}
    </div>
  );
}

export function SearchBarSkeleton() {
  return (
    <div className="skeleton-search-bar">
      <Skeleton style={{ height: '2.5rem', flex: '1 1 280px' }} />
      <Skeleton style={{ height: '2.5rem', width: '5.5rem' }} />
      <Skeleton style={{ height: '2.5rem', width: '6.5rem' }} />
      <Skeleton style={{ height: '2.5rem', width: '5.5rem' }} />
    </div>
  );
}

export function FormSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-form-section">
      <Skeleton style={{ height: '1rem', width: '8rem' }} />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index}>
          <Skeleton style={{ height: '0.75rem', width: '5rem', marginBottom: '0.5rem' }} />
          <Skeleton style={{ height: '2.5rem', width: '100%' }} />
        </div>
      ))}
      <Skeleton style={{ height: '2.5rem', width: '6rem', alignSelf: 'flex-start' }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-row">
        <Skeleton style={{ height: '0.75rem' }} />
        <Skeleton style={{ height: '0.75rem' }} />
        <Skeleton style={{ height: '0.75rem' }} />
        <Skeleton style={{ height: '0.75rem' }} />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-table-row">
          <Skeleton style={{ height: '0.875rem' }} />
          <Skeleton style={{ height: '0.875rem' }} />
          <Skeleton style={{ height: '0.875rem' }} />
          <Skeleton style={{ height: '0.875rem' }} />
        </div>
      ))}
    </div>
  );
}

export function ListCardSkeleton() {
  return (
    <div className="skeleton-list-card" style={{ padding: 'var(--space-4)' }}>
      <Skeleton style={{ height: '1rem', width: '45%', marginBottom: '0.75rem' }} />
      <Skeleton style={{ height: '0.75rem', width: '35%', marginBottom: '0.5rem' }} />
      <Skeleton style={{ height: '0.875rem', width: '100%' }} />
      <Skeleton style={{ height: '0.875rem', width: '92%', marginTop: '0.5rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <Skeleton style={{ height: '1.75rem', width: '6rem' }} />
        <Skeleton style={{ height: '1.75rem', width: '5rem' }} />
      </div>
    </div>
  );
}

export function ListCardStackSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {Array.from({ length: count }).map((_, index) => (
        <ListCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function PageBootSkeleton() {
  return (
    <div className="skeleton-page-boot">
      <Skeleton style={{ height: '3rem', width: '3rem', borderRadius: 'var(--radius-full)' }} />
      <Skeleton style={{ height: '1rem', width: '8rem' }} />
    </div>
  );
}

export function ChatPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="skeleton-chat-header">
        <Skeleton style={{ height: '1.5rem', width: '10rem' }} />
        <Skeleton style={{ height: '2rem', width: '8rem' }} />
      </div>
      <div className="skeleton-chat-main" style={{ flex: 1 }}>
        <div className="skeleton-chat-bubble">
          <Skeleton style={{ height: '3.5rem', width: '16rem', borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div className="skeleton-chat-bubble is-user">
          <Skeleton style={{ height: '2.5rem', width: '12rem', borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div className="skeleton-chat-bubble">
          <Skeleton style={{ height: '5rem', width: '20rem', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
        <Skeleton style={{ height: '2.75rem', width: '100%', borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}

export function AgentDetailPageSkeleton() {
  return (
    <div>
      <Skeleton style={{ height: '0.875rem', width: '12rem', marginBottom: 'var(--space-4)' }} />
      <div className="skeleton-agent-detail-tabs">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} style={{ height: '2rem', width: '4.5rem' }} />
        ))}
      </div>
      <DetailPanelGridSkeleton count={4} />
      <div style={{ marginTop: 'var(--space-5)' }}>
        <FormSectionSkeleton rows={4} />
      </div>
    </div>
  );
}

export function InlineCardSkeleton({ height = '9rem' }: { height?: string }) {
  return <Skeleton style={{ height, width: '100%', borderRadius: 'var(--radius-xl)' }} />;
}

export function SkillAcquiredCardSkeleton() {
  return (
    <div className="skill-acquired-card purchasing">
      <div className="skill-acquired-header">
        <Skeleton style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)' }} />
        <div style={{ flex: 1 }}>
          <Skeleton style={{ height: '0.875rem', width: '60%' }} />
          <Skeleton style={{ height: '0.75rem', width: '40%', marginTop: '0.375rem' }} />
        </div>
        <Skeleton style={{ height: '1.25rem', width: '4rem', borderRadius: 'var(--radius-full)' }} />
      </div>
    </div>
  );
}
