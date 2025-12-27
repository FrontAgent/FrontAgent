import React from 'react';

export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'bars' | 'skeleton';

export interface LoadingProps {
  variant?: LoadingVariant;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  text?: string;
}

/**
 * Loading component with different styles for loading states
 */
export const Loading: React.FC<LoadingProps> = ({
  variant = 'spinner',
  size = 'md',
  color = 'primary',
  className = '',
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    white: 'text-white'
  };

  const baseClasses = `${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  const renderSpinner = () => (
    <svg
      className={`animate-spin ${baseClasses}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const renderDots = () => {
    const dotSize = {
      sm: 'w-1 h-1',
      md: 'w-2 h-2',
      lg: 'w-3 h-3'
    };

    return (
      <div className="flex space-x-1">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${dotSize[size]} ${colorClasses[color]} rounded-full animate-bounce`}
            style={{ animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>
    );
  };

  const renderPulse = () => (
    <div className={`${baseClasses} rounded-full bg-current animate-pulse`} />
  );

  const renderBars = () => {
    const barSize = {
      sm: 'w-1 h-4',
      md: 'w-1.5 h-6',
      lg: 'w-2 h-8'
    };

    return (
      <div className="flex space-x-1 items-end">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`${barSize[size]} ${colorClasses[color]} rounded-sm animate-pulse`}
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    );
  };

  const renderSkeleton = () => {
    const skeletonSize = {
      sm: 'h-4',
      md: 'h-6',
      lg: 'h-8'
    };

    return (
      <div className={`w-full ${skeletonSize[size]} bg-gray-200 rounded animate-pulse`} />
    );
  };

  const renderVariant = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'bars':
        return renderBars();
      case 'skeleton':
        return renderSkeleton();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      {renderVariant()}
      {text && (
        <p className={`text-sm ${colorClasses[color]} ${variant === 'skeleton' ? 'sr-only' : ''}`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default Loading;