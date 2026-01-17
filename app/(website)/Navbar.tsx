'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: '特色', href: '#features' },
    { name: '玩法', href: '#gameplay' },
    { name: '公告', href: '#updates' },
    { name: 'GitHub', href: 'https://github.com/ChurchTao/wanjiedaoyou' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-2 nav-glass' : 'py-4 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
        {/* Logo Text */}
        <Link href="/" className="flex items-center gap-2 group no-underline">
          <div className="relative w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:rotate-12">
            <Image
              src="/assets/daoyou_logo.png"
              alt="Logo"
              fill
              className="object-contain"
            />
          </div>
          <span
            className={`font-heading text-xl md:text-2xl text-ink transition-opacity ${
              scrolled ? 'opacity-100' : 'opacity-80'
            }`}
          >
            万界道友
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              className="nav-link text-ink hover:text-crimson"
            >
              {link.name}
            </a>
          ))}
          <Link
            href="/create"
            className="px-4 py-1.5 border border-ink text-ink rounded hover:bg-ink hover:text-paper transition-colors text-sm"
          >
            开启修行
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-ink"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <IconMenu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-paper/95 backdrop-blur-md border-b border-ink/10 p-4 shadow-lg flex flex-col gap-4 animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-lg font-heading text-ink text-center py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <Link
            href="/create"
            onClick={() => setMenuOpen(false)}
            className="block text-center py-3 bg-ink text-paper rounded"
          >
            开启修行
          </Link>
        </div>
      )}
    </header>
  );
}
