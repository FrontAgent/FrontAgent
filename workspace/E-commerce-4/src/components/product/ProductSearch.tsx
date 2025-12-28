import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'suggestion' | 'hot';
}

interface ProductSearchProps {
  onSearch?: (keyword: string) => void;
  placeholder?: string;
  hotKeywords?: string[];
  className?: string;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  onSearch,
  placeholder = '搜索商品',
  hotKeywords = ['手机', '笔记本', '耳机', '平板', '智能手表'],
  className = '',
}) => {
  const [keyword, setKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('productSearchHistory');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const mockSuggestions: SearchSuggestion[] = [
      { id: '1', text: `${query} 手机`, type: 'suggestion' },
      { id: '2', text: `${query} 配件`, type: 'suggestion' },
      { id: '3', text: `${query} 保护壳`, type: 'suggestion' },
      { id: '4', text: `${query} 充电器`, type: 'suggestion' },
    ];
    setSuggestions(mockSuggestions);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const saveToHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const newHistory = [trimmed, ...searchHistory.filter((h) => h !== trimmed)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('productSearchHistory', JSON.stringify(newHistory));
  };

  const handleSearch = (searchTerm?: string) => {
    const term = searchTerm || keyword;
    if (!term.trim()) return;

    saveToHistory(term);
    setShowDropdown(false);
    onSearch?.(term.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setKeyword('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('productSearchHistory');
  };

  const handleSuggestionClick = (text: string) => {
    setKeyword(text);
    handleSearch(text);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="text-blue-600 font-medium">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const handleFocus = () => {
    setIsFocused(true);
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      <div
        className={`flex items-center bg-white border-2 rounded-full transition-all duration-200 ${
          isFocused ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="pl-4 text-gray-400">
          <svg
            className="w-5 h-5"
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
          ref={inputRef}
          type="text"
          value={keyword}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 px-3 py-3 text-gray-700 bg-transparent outline-none placeholder-gray-400"
        />

        {keyword && (
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        <button
          onClick={() => handleSearch()}
          className="px-6 py-3 bg-blue-500 text-white font-medium rounded-full hover:bg-blue-600 transition-colors mr-1"
          type="button"
        >
          搜索
        </button>
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
        >
          {keyword && suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs text-gray-500 font-medium">搜索建议</div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className="w-full flex items-center px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  type="button"
                >
                  <svg
                    className="w-4 h-4 text-gray-400 mr-3"
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
                  <span className="text-gray-700">
                    {highlightMatch(suggestion.text, keyword)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!keyword && searchHistory.length > 0 && (
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-gray-500 font-medium">搜索历史</span>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  type="button"
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2 px-3 py-1">
                {searchHistory.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(term)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-gray-200 transition-colors"
                    type="button"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!keyword && hotKeywords.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs text-gray-500 font-medium flex items-center">
                <svg
                  className="w-4 h-4 text-orange-500 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                    clipRule="evenodd"
                  />
                </svg>
                热门搜索
              </div>
              <div className="flex flex-wrap gap-2 px-3 py-1">
                {hotKeywords.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(term)}
                    className="px-3 py-1.5 bg-orange-50 text-orange-600 text-sm rounded-full hover:bg-orange-100 transition-colors"
                    type="button"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSearch;