import { useMemo, useState } from 'react';
import { Funnel, MagnifyingGlass } from '@phosphor-icons/react';
import './CatalogSearchPanel.css';

export type CatalogSearchFilters = {
  query: string;
  tag: string;
  status: string;
  since: string;
  until: string;
  minScore: string;
  skillSlug: string;
  scope: 'marketplace' | 'mine';
};

export const defaultCatalogSearchFilters: CatalogSearchFilters = {
  query: '',
  tag: '',
  status: '',
  since: '',
  until: '',
  minScore: '0',
  skillSlug: '',
  scope: 'marketplace',
};

type CatalogSearchPanelProps = {
  filters: CatalogSearchFilters;
  onChange: (filters: CatalogSearchFilters) => void;
  onSearch: () => void;
  onBrowseAll: () => void;
  loading?: boolean;
};

function countActiveFilters(filters: CatalogSearchFilters): number {
  let count = 0;
  if (filters.tag.trim()) count += 1;
  if (filters.status) count += 1;
  if (filters.since) count += 1;
  if (filters.until) count += 1;
  if (filters.skillSlug.trim()) count += 1;
  if (filters.minScore && filters.minScore !== '0') count += 1;
  if (filters.scope !== 'marketplace') count += 1;
  return count;
}

export function CatalogSearchPanel({
  filters,
  onChange,
  onSearch,
  onBrowseAll,
  loading = false,
}: CatalogSearchPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  function patch(partial: Partial<CatalogSearchFilters>) {
    onChange({ ...filters, ...partial });
  }

  function onFilterKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch();
    }
  }

  function clearAdvancedFilters() {
    onChange({
      ...filters,
      tag: '',
      status: '',
      since: '',
      until: '',
      minScore: '0',
      skillSlug: '',
      scope: 'marketplace',
    });
  }

  return (
    <div className="catalog-search-panel">
      <div className="catalog-search-bar">
        <div className="catalog-search-input-wrap">
          <MagnifyingGlass size={16} className="catalog-search-icon" aria-hidden />
          <input
            className="input catalog-search-input"
            placeholder="Search marketplace skills…"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            onKeyDown={onFilterKeyDown}
          />
        </div>

        <div className="catalog-search-actions">
          <button type="button" className="btn btn-primary" onClick={onSearch} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBrowseAll} disabled={loading}>
            Browse all
          </button>
          <button
            type="button"
            className={`btn btn-secondary catalog-search-filters-btn${advancedOpen ? ' is-active' : ''}`}
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
          >
            <Funnel size={14} />
            Filters
            {activeFilterCount > 0 ? <span className="catalog-search-filter-count">{activeFilterCount}</span> : null}
          </button>
        </div>
      </div>

      {advancedOpen ? (
        <div className="catalog-search-advanced">
          <div className="catalog-search-advanced-grid">
            <input
              className="input"
              placeholder="Tag"
              value={filters.tag}
              onChange={(event) => patch({ tag: event.target.value })}
              onKeyDown={onFilterKeyDown}
            />
            <select
              className="input"
              value={filters.status}
              onChange={(event) => patch({ status: event.target.value })}
            >
              <option value="">Any status</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <input
              type="datetime-local"
              className="input"
              value={filters.since}
              onChange={(event) => patch({ since: event.target.value })}
            />
            <input
              type="datetime-local"
              className="input"
              value={filters.until}
              onChange={(event) => patch({ until: event.target.value })}
            />
            <input
              className="input"
              placeholder="Skill slug"
              value={filters.skillSlug}
              onChange={(event) => patch({ skillSlug: event.target.value })}
              onKeyDown={onFilterKeyDown}
            />
            <input
              className="input"
              placeholder="Min score"
              value={filters.minScore}
              onChange={(event) => patch({ minScore: event.target.value })}
              onKeyDown={onFilterKeyDown}
            />
            <select
              className="input catalog-search-scope"
              value={filters.scope}
              onChange={(event) => patch({ scope: event.target.value as CatalogSearchFilters['scope'] })}
            >
              <option value="marketplace">Marketplace (published only)</option>
              <option value="mine">My listings only</option>
            </select>
          </div>

          <div className="catalog-search-advanced-actions">
            {activeFilterCount > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAdvancedFilters}>
                Clear filters
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" onClick={onSearch} disabled={loading}>
              Apply filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
