/* eslint-disable @next/next/no-img-element */
export function OpenCluLogo({
  className,
  markOnly = false,
  priority,
}: {
  className?: string;
  markOnly?: boolean;
  priority?: boolean;
}) {
  const lightSrc = markOnly ? "/openclu_logo_only_light.png" : "/openclu_logo_light.png";
  const darkSrc = markOnly ? "/openclu_logo_only_dark.png" : "/openclu_logo_dark.png";

  return (
    <>
      <img
        src={lightSrc}
        alt="OpenClu"
        loading={priority ? "eager" : "lazy"}
        className={`object-contain dark:hidden ${className ?? ""}`}
      />
      <img
        src={darkSrc}
        alt="OpenClu"
        loading={priority ? "eager" : "lazy"}
        className={`hidden object-contain dark:block ${className ?? ""}`}
      />
    </>
  );
}
