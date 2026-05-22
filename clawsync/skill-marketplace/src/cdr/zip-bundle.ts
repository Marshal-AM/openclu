import AdmZip from "adm-zip";

/** Zip a skill bundle directory (SKILL.md, transcript, etc.) for CDR upload. */
export function zipSkillBundle(bundleDir: string): Buffer {
  const zip = new AdmZip();
  zip.addLocalFolder(bundleDir, "");
  return zip.toBuffer();
}

export function unzipToDir(zipBytes: Buffer, outDir: string) {
  const zip = new AdmZip(zipBytes);
  zip.extractAllTo(outDir, true);
}
