import './OpenCluLogo.css';

type OpenCluLogoProps = {
  className?: string;
  markOnly?: boolean;
};

export function OpenCluLogo({ className, markOnly = false }: OpenCluLogoProps) {
  const lightSrc = markOnly ? '/openclu_logo_only_light.png' : '/openclu_logo_light.png';
  const darkSrc = markOnly ? '/openclu_logo_only_dark.png' : '/openclu_logo_dark.png';

  return (
    <>
      <img src={lightSrc} alt="OpenClu" className={`openclu-logo openclu-logo--light ${className ?? ''}`} />
      <img src={darkSrc} alt="OpenClu" className={`openclu-logo openclu-logo--dark ${className ?? ''}`} />
    </>
  );
}
