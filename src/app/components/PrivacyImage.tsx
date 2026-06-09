import type { PrivacyRegion } from '../types/emergency';
import { cn } from './ui/utils';

interface PrivacyImageProps {
  src?: string | null;
  alt: string;
  allowUnblurred: boolean;
  className?: string;
  wrapperClassName?: string;
  blurredLabel?: string;
  privacyRegions?: PrivacyRegion[];
}

export function PrivacyImage({
  src,
  alt,
  allowUnblurred,
  className,
  wrapperClassName,
  blurredLabel = 'Blurred for privacy',
  privacyRegions = []
}: PrivacyImageProps) {
  if (!src) return null;

  const hasRegions = privacyRegions.length > 0;

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)}>
      <img
        src={src}
        alt={alt}
        className={className}
      />
      {!allowUnblurred && hasRegions && (
        <div className="absolute inset-0 overflow-hidden">
          {privacyRegions.map((region, index) => (
            <div
              key={`${region.label}-${index}`}
              className="absolute rounded-lg border border-white/35 bg-black/15 backdrop-blur-2xl"
              style={{
                left: `${region.left}%`,
                top: `${region.top}%`,
                width: `${region.width}%`,
                height: `${region.height}%`
              }}
              aria-label={`Sensitive region: ${region.label}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
