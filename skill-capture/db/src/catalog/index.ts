export {
  catalogQuery,
  catalogQueryTraining,
  catalogGetSkill,
  catalogGetSkillDetail,
  catalogGetTrainingDetail,
  catalogStats,
  type CatalogQueryBody,
} from "../catalog-read-bridge.js";
export {
  fetchSkillCatalogDetail,
  fetchTrainingCatalogDetail,
  type CatalogDetailScope,
} from "./detail.js";
export {
  searchNaturalLanguage,
  searchTrainingNaturalLanguage,
  getCatalogStats,
  type ListingFilters,
  type ListingQueryScope,
} from "./query.js";
