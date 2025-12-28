import React, { useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  children?: MenuItem[];
  onClick?: () => void;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  items: MenuItem[];
  className?: string;
  activeItemId?: string;
  onItemClick?: (item: MenuItem) => void;
}

interface SidebarItemProps {
  item: MenuItem;
  isActive: boolean;
  isCollapsed: boolean;
  onItemClick?: (item: MenuItem) => void;
  activeItemId?: string;
  level?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isActive,
  isCollapsed,
  onItemClick,
  activeItemId,
  level = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      item.onClick?.();
      onItemClick?.(item);
    }
  };

  const paddingLeft = isCollapsed ? 'pl-4' : `pl-${4 + level * 4}`;

  return (
    <div>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-3 px-4 py-3 text-left
          transition-all duration-200 ease-in-out
          hover:bg-gray-100 dark:hover:bg-gray-700
          ${isActive ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
          ${paddingLeft}
        `}
      >
        {item.icon && (
          <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
        )}
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {hasChildren && (
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </>
        )}
      </button>
      {hasChildren && isExpanded && !isCollapsed && (
        <div className="overflow-hidden transition-all duration-200">
          {item.children!.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              isActive={activeItemId === child.id}
              isCollapsed={isCollapsed}
              onItemClick={onItemClick}
              activeItemId={activeItemId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  items,
  className = '',
  activeItemId,
  onItemClick,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'}
          lg:relative lg:translate-x-0
          ${className}
        `}
      >
        {/* Toggle button */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {isOpen && (
            <span className="text-xl font-semibold text-gray-800 dark:text-white">
              Menu
            </span>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg
              className={`w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto py-4">
          {items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
              isCollapsed={!isOpen}
              onItemClick={onItemClick}
              activeItemId={activeItemId}
            />
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;