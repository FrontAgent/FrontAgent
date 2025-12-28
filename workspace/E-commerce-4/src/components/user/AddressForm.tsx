import React, { useState, useEffect } from 'react';

interface Address {
  id?: string;
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district: string;
  detailAddress: string;
  postalCode?: string;
  isDefault: boolean;
  label: string;
}

interface AddressFormProps {
  initialData?: Address;
  mode: 'add' | 'edit';
  onSave: (address: Address) => void;
  onCancel: () => void;
}

const provinces = ['北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省', '湖北省', '山东省'];

const cityData: Record<string, string[]> = {
  '北京市': ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区'],
  '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区'],
  '广东省': ['广州市', '深圳市', '珠海市', '东莞市', '佛山市', '中山市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市'],
  '江苏省': ['南京市', '苏州市', '无锡市', '常州市', '南通市', '扬州市'],
  '四川省': ['成都市', '绵阳市', '德阳市', '宜宾市', '泸州市', '乐山市'],
  '湖北省': ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄石市', '十堰市'],
  '山东省': ['济南市', '青岛市', '烟台市', '潍坊市', '临沂市', '淄博市'],
};

const districtData: Record<string, string[]> = {
  '东城区': ['东华门街道', '景山街道', '交道口街道', '安定门街道'],
  '西城区': ['西长安街街道', '新街口街道', '月坛街道', '展览路街道'],
  '朝阳区': ['建外街道', '朝外街道', '呼家楼街道', '三里屯街道'],
  '海淀区': ['万寿路街道', '羊坊店街道', '甘家口街道', '八里庄街道'],
  '黄浦区': ['南京东路街道', '外滩街道', '半淞园路街道', '小东门街道'],
  '徐汇区': ['湖南路街道', '斜土路街道', '枫林路街道', '长桥街道'],
  '广州市': ['天河区', '越秀区', '海珠区', '荔湾区', '白云区'],
  '深圳市': ['福田区', '罗湖区', '南山区', '宝安区', '龙岗区'],
  '杭州市': ['上城区', '下城区', '江干区', '拱墅区', '西湖区'],
  '宁波市': ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区'],
  '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区'],
  '苏州市': ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区'],
  '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区'],
  '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区'],
  '济南市': ['历下区', '市中区', '槐荫区', '天桥区', '历城区'],
  '青岛市': ['市南区', '市北区', '黄岛区', '崂山区', '李沧区'],
};

const addressLabels = ['家', '公司', '学校', '其他'];

export const AddressForm: React.FC<AddressFormProps> = ({
  initialData,
  mode,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Address>({
    recipientName: '',
    phoneNumber: '',
    province: '',
    city: '',
    district: '',
    detailAddress: '',
    postalCode: '',
    isDefault: false,
    label: '家',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  useEffect(() => {
    if (initialData && mode === 'edit') {
      setFormData(initialData);
      if (initialData.province) {
        setCities(cityData[initialData.province] || []);
      }
      if (initialData.city) {
        setDistricts(districtData[initialData.city] || []);
      }
    }
  }, [initialData, mode]);

  const handleProvinceChange = (province: string) => {
    setFormData((prev) => ({
      ...prev,
      province,
      city: '',
      district: '',
    }));
    setCities(cityData[province] || []);
    setDistricts([]);
  };

  const handleCityChange = (city: string) => {
    setFormData((prev) => ({
      ...prev,
      city,
      district: '',
    }));
    setDistricts(districtData[city] || []);
  };

  const handleDistrictChange = (district: string) => {
    setFormData((prev) => ({
      ...prev,
      district,
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recipientName.trim()) {
      newErrors.recipientName = '请输入收货人姓名';
    } else if (formData.recipientName.length < 2) {
      newErrors.recipientName = '姓名至少2个字符';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = '请输入手机号码';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = '请输入有效的手机号码';
    }

    if (!formData.province) {
      newErrors.province = '请选择省份';
    }

    if (!formData.city) {
      newErrors.city = '请选择城市';
    }

    if (!formData.district) {
      newErrors.district = '请选择区县';
    }

    if (!formData.detailAddress.trim()) {
      newErrors.detailAddress = '请输入详细地址';
    } else if (formData.detailAddress.length < 5) {
      newErrors.detailAddress = '详细地址至少5个字符';
    }

    if (formData.postalCode && !/^\d{6}$/.test(formData.postalCode)) {
      newErrors.postalCode = '邮政编码应为6位数字';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (field: keyof Address, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {mode === 'add' ? '新增收货地址' : '编辑收货地址'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            收货人姓名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.recipientName}
            onChange={(e) => handleInputChange('recipientName', e.target.value)}
            placeholder="请输入收货人姓名"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.recipientName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.recipientName && (
            <p className="mt-1 text-sm text-red-500">{errors.recipientName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            手机号码 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
            placeholder="请输入手机号码"
            maxLength={11}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.phoneNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              省份 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.province}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.province ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {errors.province && (
              <p className="mt-1 text-sm text-red-500">{errors.province}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              城市 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.city}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={!formData.province}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {errors.city && (
              <p className="mt-1 text-sm text-red-500">{errors.city}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              区县 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.district}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!formData.city}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                errors.district ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
            {errors.district && (
              <p className="mt-1 text-sm text-red-500">{errors.district}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            详细地址 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.detailAddress}
            onChange={(e) => handleInputChange('detailAddress', e.target.value)}
            placeholder="请输入街道、门牌号等详细地址"
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              errors.detailAddress ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.detailAddress && (
            <p className="mt-1 text-sm text-red-500">{errors.detailAddress}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            邮政编码
          </label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) => handleInputChange('postalCode', e.target.value)}
            placeholder="请输入邮政编码（选填）"
            maxLength={6}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.postalCode ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.postalCode && (
            <p className="mt-1 text-sm text-red-500">{errors.postalCode}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            地址标签
          </label>
          <div className="flex gap-2">
            {addressLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleInputChange('label', label)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  formData.label === label
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isDefault"
            checked={formData.isDefault}
            onChange={(e) => handleInputChange('isDefault', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
            设为默认地址
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {mode === 'add' ? '添加地址' : '保存修改'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          取消
        </button>
      </div>
    </form>
  );
};