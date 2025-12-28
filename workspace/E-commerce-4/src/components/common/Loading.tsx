import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className = '',
}) => {
  const spinner = (
    <div
      className={`
        ${sizeClasses[size]}
        border-gray-200
        border-t-blue-600
        rounded-full
        animate-spin
      `}
    />
  );

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {spinner}
      {text && (
        <span className={`text-gray-600 ${textSizeClasses[size]}`}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

export default Loading;