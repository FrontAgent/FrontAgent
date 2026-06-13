import { useEffect, useState } from 'react';
import type { DesktopSettings, FrontAgentBridge } from '../../ipc/contract.js';

const FIELDS: { key: keyof DesktopSettings; label: string; placeholder: string }[] = [
  { key: 'provider', label: 'Provider', placeholder: 'anthropic' },
  { key: 'model', label: 'Model', placeholder: 'claude-opus-4-8' },
  { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.anthropic.com' },
  { key: 'defaultWorkspacePath', label: '默认工作区', placeholder: '~/projects' },
];

export function SettingsPanel({ bridge }: { bridge: FrontAgentBridge }) {
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    bridge.getSettings().then(setSettings);
  }, [bridge]);

  if (!settings) return <div className="settings">加载中…</div>;

  const update = (key: keyof DesktopSettings, value: string) => {
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const save = async () => {
    await bridge.saveSettings(settings);
    setSaved(true);
  };

  return (
    <div className="settings">
      <h2>设置</h2>
      <p className="hint">
        凭据与默认值在本机保存（PR3 接入安全存储）。Base URL 留空使用 provider 默认。
      </p>
      {FIELDS.map((field) => (
        <div className="setting-group" key={field.key}>
          <label htmlFor={field.key}>{field.label}</label>
          <input
            id={field.key}
            value={settings[field.key] ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => update(field.key, e.target.value)}
          />
        </div>
      ))}
      <button type="button" className="btn btn-primary" onClick={save}>
        保存设置
        {saved ? <span className="settings-saved">✓ 已保存</span> : null}
      </button>
    </div>
  );
}
