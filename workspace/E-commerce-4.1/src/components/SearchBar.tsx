import React, { useState } from 'react';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = '搜索...'
}) => {
  const [internalValue, setInternalValue] = useState('');
  
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleClear = () => {
    const newValue = '';
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
    onSearch?.(newValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(currentValue);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <div className="absolute left-3 md:left-4 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        
        <input
          type="text"
          value={currentValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 md:pl-12 pr-10 md:pr-12 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        
        {currentValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 md:right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="清除搜索"
          >
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
};