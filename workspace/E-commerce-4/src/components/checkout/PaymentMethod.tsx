import React from 'react';

export interface PaymentMethodOption {
  id: string;
  name: string;
  icon: string;
  description?: string;
  disabled?: boolean;
}

interface PaymentMethodProps {
  methods?: PaymentMethodOption[];
  selectedMethod: string | null;
  onChange: (methodId: string) => void;
}

const defaultPaymentMethods: PaymentMethodOption[] = [
  {
    id: 'alipay',
    name: '支付宝',
    icon: '💳',
    description: '推荐使用，支持花呗分期',
  },
  {
    id: 'wechat',
    name: '微信支付',
    icon: '💚',
    description: '微信扫码或直接支付',
  },
  {
    id: 'card',
    name: '银行卡支付',
    icon: '🏦',
    description: '支持储蓄卡和信用卡',
  },
  {
    id: 'cod',
    name: '货到付款',
    icon: '📦',
    description: '送达时现金或刷卡支付',
  },
];

export const PaymentMethod: React.FC<PaymentMethodProps> = ({
  methods = defaultPaymentMethods,
  selectedMethod,
  onChange,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">支付方式</h2>
      
      <div className="space-y-3">
        {methods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const isDisabled = method.disabled;
          
          return (
            <div
              key={method.id}
              onClick={() => !isDisabled && onChange(method.id)}
              className={`
                relative flex items-center p-4 rounded-lg border-2 transition-all duration-200
                ${isDisabled 
                  ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
                  : isSelected
                    ? 'border-blue-500 bg-blue-50 cursor-pointer'
                    : 'border-gray-200 hover:border-gray-300 cursor-pointer hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center flex-1">
                <span className="text-2xl mr-4">{method.icon}</span>
                
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className={`font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                      {method.name}
                    </span>
                    {isDisabled && (
                      <span className="ml-2 text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                        暂不可用
                      </span>
                    )}
                  </div>
                  {method.description && (
                    <p className={`text-sm mt-0.5 ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                      {method.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${isDisabled
                  ? 'border-gray-300'
                  : isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }
              `}>
                {isSelected && !isDisabled && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              
              {isSelected && !isDisabled && (
                <div className="absolute top-2 right-2">
                  <svg 
                    className="w-5 h-5 text-blue-500" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {!selectedMethod && (
        <p className="mt-4 text-sm text-amber-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path 
              fillRule="evenodd" 
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
          请选择一种支付方式
        </p>
      )}
    </div>
  );
};

export default PaymentMethod;