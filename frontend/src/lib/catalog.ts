import {
  getCatalogSkill,
  getCatalogSkillDetail as fetchCatalogSkillDetail,
  getCatalogStats,
  getCatalogTrainingDetail,
  queryCatalog,
  queryCatalogTraining,
  type CatalogQueryBody,
} from "@/lib/supabase/catalog";

export type { CatalogQueryBody };

export type CatalogDetailParams = {
  ownerAddress?: string;
  listingKey?: string;
  kind?: "skill" | "training";
};

export {
  getCatalogSkill,
  getCatalogStats,
  queryCatalog,
  queryCatalogTraining,
};

export async function getCatalogSkillDetail(
  skillName: string,
  params?: CatalogDetailParams,
) {
  if (params?.kind === "training") {
    return getCatalogTrainingDetail(skillName, params.ownerAddress, params.listingKey);
  }
  return fetchCatalogSkillDetail(skillName, params?.ownerAddress, params?.listingKey);
}
