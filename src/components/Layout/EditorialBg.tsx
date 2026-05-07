import React from 'react';

export const EditorialBg: React.FC = () => (
  <div className="fixed inset-0 -z-10 bg-base overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-150" />
    <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5" />
    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/5" />
  </div>
);
