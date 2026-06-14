import type { DesktopSettings, FrontAgentBridge } from '../../ipc/contract.js';
import { useSettings } from '../store/useSettings.js';

const FIELDS: { key: keyof DesktopSettings; label: string; placeholder: string }[] = [
  { key: 'provider', label: 'Provider', placeholder: 'anthropic' },
  { key: 'model', label: 'Model', placeholder: 'claude-opus-4-8' },
  { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.anthropic.com' },
  { key: 'defaultWorkspacePath', label: '默认工作区', placeholder: '~/projects' },
];

export function SettingsPanel({ bridge }: { bridge: FrontAgentBridge }) {
  const { state, update, save, retryLoad } = useSettings(bridge);

  if (state.status === 'loading') return <div className="settings">加载中…</div>;

  if (state.status === 'load-error' || !state.settings) {
    return (
      <div className="settings">
        <h2>设置</h2>
        <div className="settings-error" role="alert">
          无法加载设置：{state.error ?? '未知错误'}
        </div>
        <button type="button" className="btn btn-primary" onClick={retryLoad}>
          重试
        </button>
      </div>
    );
  }

  const { settings, status, saved, error } = state;
  const saving = status === 'saving';

  return (
    <div className="settings">
      <h2>设置</h2>
      <p className="hint">
        设置持久化到本机用户目录（app.getPath('userData')/settings.json）。Base URL 留空使用
        provider 默认；API Key 从环境变量读取。
      </p>
      {FIELDS.map((field) => (
        <div className="setting-group" key={field.key}>
          <label htmlFor={field.key}>{field.label}</label>
          <input
            id={field.key}
            value={settings[field.key] ?? ''}
            placeholder={field.placeholder}
            disabled={saving}
            onChange={(e) => update(field.key, e.target.value)}
          />
        </div>
      ))}
      {status === 'save-error' ? (
        <div className="settings-error" role="alert">
          保存失败：{error ?? '未知错误'}
        </div>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? '保存中…' : status === 'save-error' ? '重试保存' : '保存设置'}
      </button>
      <span className="settings-saved" role="status" aria-live="polite">
        {saved ? '✓ 已保存' : ''}
      </span>
    </div>
  );
}
