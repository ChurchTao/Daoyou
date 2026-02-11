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
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled ? 'nav-glass py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
        {/* Logo Text */}
        <Link href="/" className="group flex items-center gap-2 no-underline">
          <div className="relative h-8 w-8 transition-transform group-hover:rotate-12 md:h-10 md:w-10">
            <Image
              src="/assets/daoyou_logo.png"
              alt="Logo"
              fill
              className="object-contain"
            />
          </div>
          <span
            className={`font-heading text-ink text-xl transition-opacity md:text-2xl ${
              scrolled ? 'opacity-100' : 'opacity-80'
            }`}
          >
            万界道友
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
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
            href="/game/create"
            className="border-ink text-ink hover:bg-ink hover:text-paper rounded border px-4 py-1.5 text-sm transition-colors"
          >
            开启修行
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="text-ink p-2 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <IconMenu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="bg-paper/95 border-ink/10 animate-in slide-in-from-top-2 absolute top-full right-0 left-0 flex flex-col gap-4 border-b p-4 shadow-lg backdrop-blur-md md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="font-heading text-ink py-2 text-center text-lg"
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <Link
            href="/game/create"
            onClick={() => setMenuOpen(false)}
            className="bg-ink text-paper block rounded py-3 text-center"
          >
            开启修行
          </Link>
        </div>
      )}
    </header>
  );
}
