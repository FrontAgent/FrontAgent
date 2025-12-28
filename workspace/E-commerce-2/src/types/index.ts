/**
 * 类型定义统一导出入口
 * 
 * 此文件作为类型定义的中央导出点，重新导出所有类型定义模块。
 * 使用此文件可以简化类型导入，避免深层次的导入路径。
 * 
 * @example
 * // 推荐使用方式
 * import { Product, User, CartItem } from '@/types';
 * 
 * // 而不是
 * import { Product } from '@/types/product';
 * import { User } from '@/types/user';
 * import { CartItem } from '@/types/cart';
 */

export * from './product';
export * from './user';
export * from './cart';