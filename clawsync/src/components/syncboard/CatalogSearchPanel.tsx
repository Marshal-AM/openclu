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
  minScore: '',
  skillSlug: '',
  scope: 'marketplace',
};

type CatalogSearchPanelProps = {
  filters: CatalogSearchFilters;
  onChange: (filters: CatalogSearchFilters) => void;
  onSearch: () => void;
  loading?: boolean;
  searchPlaceholder?: string;
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
  loading = false,
  searchPlaceholder = 'Search marketplace listings…',
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
      minScore: '',
      skillSlug: '',
      scope: 'marketplace',
    });
  }

  return (
    <div className="catalog-search-panel">
      <div className="catalog-search-bar">
        <div className="catalog-search-input-wrap">
          <MagnifyingGlass size={18} weight="regular" className="catalog-search-icon" aria-hidden />
          <input
            className="catalog-search-input"
            placeholder={searchPlaceholder}
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            onKeyDown={onFilterKeyDown}
          />
        </div>

        <div className="catalog-search-actions">
          <button type="button" className="btn btn-primary" onClick={onSearch} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
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
            <label className="catalog-search-field-label">
              Tag
              <input
                className="catalog-search-field"
                placeholder="e.g. cursor, api"
                value={filters.tag}
                onChange={(event) => patch({ tag: event.target.value })}
                onKeyDown={onFilterKeyDown}
              />
            </label>
            <label className="catalog-search-field-label">
              Status
              <select
                className="catalog-search-field"
                value={filters.status}
                onChange={(event) => patch({ status: event.target.value })}
              >
                <option value="">Any status</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label className="catalog-search-field-label">
              Published after
              <input
                type="datetime-local"
                className="catalog-search-field"
                value={filters.since}
                onChange={(event) => patch({ since: event.target.value })}
              />
            </label>
            <label className="catalog-search-field-label">
              Published before
              <input
                type="datetime-local"
                className="catalog-search-field"
                value={filters.until}
                onChange={(event) => patch({ until: event.target.value })}
              />
            </label>
            <label className="catalog-search-field-label">
              Skill slug
              <input
                className="catalog-search-field"
                placeholder="exact-slug"
                value={filters.skillSlug}
                onChange={(event) => patch({ skillSlug: event.target.value })}
                onKeyDown={onFilterKeyDown}
              />
            </label>
            <label className="catalog-search-field-label">
              Min match score
              <input
                className="catalog-search-field"
                placeholder="0–1 (e.g. 0.3)"
                value={filters.minScore}
                onChange={(event) => patch({ minScore: event.target.value })}
                onKeyDown={onFilterKeyDown}
              />
            </label>
            <label className="catalog-search-field-label catalog-search-scope">
              Scope
              <select
                className="catalog-search-field"
                value={filters.scope}
                onChange={(event) => patch({ scope: event.target.value as CatalogSearchFilters['scope'] })}
              >
                <option value="marketplace">Marketplace (published only)</option>
                <option value="mine">My listings only</option>
              </select>
            </label>
          </div>

          <div className="catalog-search-advanced-actions">
            {activeFilterCount > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAdvancedFilters}>
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary catalog-search-apply-btn"
              onClick={onSearch}
              disabled={loading}
            >
              {loading ? 'Applying…' : 'Apply filters'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
