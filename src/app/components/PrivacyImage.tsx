import type { PrivacyRegion } from '../types/emergency';
import { useState } from 'react';
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
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  if (!src) return null;

  const hasRegions = privacyRegions.length > 0;
  const getRegionStyle = (region: PrivacyRegion) => {
    const isPercent = region.normalized || (
      region.left <= 100 &&
      region.top <= 100 &&
      region.width <= 100 &&
      region.height <= 100
    );

    if (isPercent || !naturalSize) {
      return {
        left: `${Math.max(0, region.left)}%`,
        top: `${Math.max(0, region.top)}%`,
        width: `${Math.max(4, region.width)}%`,
        height: `${Math.max(4, region.height)}%`
      };
    }

    return {
      left: `${Math.max(0, (region.left / naturalSize.width) * 100)}%`,
      top: `${Math.max(0, (region.top / naturalSize.height) * 100)}%`,
      width: `${Math.max(4, (region.width / naturalSize.width) * 100)}%`,
      height: `${Math.max(4, (region.height / naturalSize.height) * 100)}%`
    };
  };

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)}>
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={(event) => {
          setNaturalSize({
            width: event.currentTarget.naturalWidth || 1,
            height: event.currentTarget.naturalHeight || 1
          });
        }}
      />
      {!allowUnblurred && hasRegions && (
        <div className="absolute inset-0 overflow-hidden">
          {privacyRegions.map((region, index) => (
            <div
              key={`${region.label}-${index}`}
              className="absolute rounded-full bg-white/5 backdrop-blur-xl"
              style={getRegionStyle(region)}
              aria-label={`Sensitive region: ${region.label}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
