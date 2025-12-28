/**
 * 用户角色枚举类型
 * @description 定义系统中可用的用户角色
 */
export type TUserRole = 'admin' | 'user' | 'guest' | 'moderator';

/**
 * 用户基本信息接口
 * @description 定义用户的核心属性
 */
export interface IUser {
  /**
   * 用户唯一标识符
   */
  id: string;
  
  /**
   * 用户邮箱地址
   */
  email: string;
  
  /**
   * 用户显示名称
   */
  name: string;
  
  /**
   * 用户头像URL
   */
  avatar?: string;
  
  /**
   * 用户角色
   */
  role: TUserRole;
  
  /**
   * 账户创建时间
   */
  createdAt: Date;
  
  /**
   * 最后更新时间
   */
  updatedAt: Date;
  
  /**
   * 账户是否激活
   */
  isActive: boolean;
}

/**
 * 用户详细信息接口
 * @description 扩展用户基本信息，包含更多详细字段
 */
export interface IUserProfile extends IUser {
  /**
   * 用户简介
   */
  bio?: string;
  
  /**
   * 用户电话号码
   */
  phone?: string;
  
  /**
   * 用户地址
   */
  address?: string;
  
  /**
   * 用户出生日期
   */
  dateOfBirth?: Date;
  
  /**
   * 用户性别
   */
  gender?: 'male' | 'female' | 'other';
  
  /**
   * 用户偏好设置
   */
  preferences?: {
    language: string;
    timezone: string;
    notifications: boolean;
  };
  
  /**
   * 最后登录时间
   */
  lastLoginAt?: Date;
}

/**
 * 用户认证凭证接口
 * @description 用于用户登录和身份验证
 */
export interface IAuthCredentials {
  /**
   * 用户邮箱或用户名
   */
  email: string;
  
  /**
   * 用户密码
   */
  password: string;
  
  /**
   * 是否记住登录状态
   */
  rememberMe?: boolean;
}

/**
 * 用户注册信息接口
 * @description 用于新用户注册
 */
export interface IUserRegistration {
  /**
   * 用户邮箱
   */
  email: string;
  
  /**
   * 用户密码
   */
  password: string;
  
  /**
   * 确认密码
   */
  confirmPassword: string;
  
  /**
   * 用户名称
   */
  name: string;
  
  /**
   * 是否同意服务条款
   */
  agreeToTerms: boolean;
}

/**
 * 用户更新信息接口
 * @description 用于更新用户信息，所有字段可选
 */
export interface IUserUpdate {
  name?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
}

/**
 * 用户查询参数接口
 * @description 用于用户列表查询和过滤
 */
export interface IUserQueryParams {
  /**
   * 页码
   */
  page?: number;
  
  /**
   * 每页数量
   */
  limit?: number;
  
  /**
   * 搜索关键词
   */
  search?: string;
  
  /**
   * 按角色过滤
   */
  role?: TUserRole;
  
  /**
   * 按激活状态过滤
   */
  isActive?: boolean;
  
  /**
   * 排序字段
   */
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'email';
  
  /**
   * 排序方向
   */
  sortOrder?: 'asc' | 'desc';
}