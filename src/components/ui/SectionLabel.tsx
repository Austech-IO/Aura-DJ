import React from 'react';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ children, className = "" }) => (
  <h2 className={`text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-6 ${className}`}>{children}</h2>
);
