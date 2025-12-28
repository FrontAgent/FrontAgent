import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  children?: NavItem[];
}

export interface NavbarProps {
  items: NavItem[];
  className?: string;
}

const DropdownMenu: React.FC<{ items: NavItem[]; isOpen: boolean }> = ({ items, isOpen }) => {
  if (!isOpen || items.length === 0) return null;

  return (
    <div className="absolute left-0 top-full mt-1 min-w-48 rounded-md bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-200">
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          {item.icon && <span className="h-4 w-4">{item.icon}</span>}
          {item.label}
        </NavLink>
      ))}
    </div>
  );
};

const NavItemComponent: React.FC<{ item: NavItem }> = ({ item }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`
        }
      >
        {item.icon && <span className="h-5 w-5">{item.icon}</span>}
        {item.label}
        {hasChildren && (
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </NavLink>
      {hasChildren && <DropdownMenu items={item.children!} isOpen={isOpen} />}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({ items, className = '' }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className={`bg-white shadow-sm ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="hidden md:block">
            <div className="flex items-center space-x-1">
              {items.map((item) => (
                <NavItemComponent key={item.href} item={item} />
              ))}
            </div>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="space-y-1 px-2 pb-3 pt-2">
          {items.map((item) => (
            <MobileNavItem key={item.href} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
};

const MobileNavItem: React.FC<{ item: NavItem; depth?: number }> = ({ item, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const paddingLeft = depth * 16 + 12;

  return (
    <div>
      <div className="flex items-center">
        <NavLink
          to={item.href}
          className={({ isActive }) =>
            `flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-base font-medium transition-colors ${
              isActive
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
          style={{ paddingLeft }}
        >
          {item.icon && <span className="h-5 w-5">{item.icon}</span>}
          {item.label}
        </NavLink>
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
          >
            <svg
              className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <div className="mt-1">
          {item.children!.map((child) => (
            <MobileNavItem key={child.href} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Navbar;