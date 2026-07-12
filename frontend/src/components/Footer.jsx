import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full py-8 mt-auto px-8 border-t border-[var(--border-subtle)] bg-transparent backdrop-blur-sm transition-colors duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-[var(--text-secondary)] text-sm font-bold">
          © {currentYear} <span className="text-indigo-500 font-black tracking-tight">DigiCertify</span>. All rights reserved.
        </div>
        
        <div className="flex items-center space-x-1 text-[10px] text-[var(--footer-dim)] font-black uppercase tracking-[0.2em]">
          <span>Developed and designed by</span>
          <span className="text-[var(--text-primary)] hover:text-indigo-400 transition-colors cursor-default ml-1">Kirran S T</span>
        </div>
      </div>
    </footer>
  );
}
