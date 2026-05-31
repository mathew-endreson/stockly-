import React from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ className, markClassName, wordmarkClassName }) => {
  return (
    <div className={cn('inline-flex items-center gap-[0.3em] leading-none', className)} aria-label="Stockly logo">
      <span className={cn('inline-flex h-8 w-14 shrink-0 items-center', markClassName)}>
        <img
          src="/stockly-logo/logo-mark-new.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </span>
      <span className={cn('inline-flex h-8 w-[6.2rem] shrink-0 items-center', wordmarkClassName)}>
        <img
          src="/stockly-logo/logo-word-new.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </span>
    </div>
  );
};

export default BrandLogo;
