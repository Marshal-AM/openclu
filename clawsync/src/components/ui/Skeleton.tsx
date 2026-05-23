import type { CSSProperties, HTMLAttributes } from 'react';
import './Skeleton.css';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  style?: CSSProperties;
};

export function Skeleton({ className = '', style, ...props }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden {...props} />;
}
