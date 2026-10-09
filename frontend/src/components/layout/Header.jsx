import { Menu, SunMedium } from 'lucide-react';
import IconButton from '../common/IconButton';
import StatusIndicator from '../common/StatusIndicator';
import LanguageSelector from '../common/LanguageSelector';
import SyncStatusIndicator from '../common/SyncStatusIndicator';
import NotificationMenu from './NotificationMenu';
import ProfileMenu from './ProfileMenu';
import { useSolarData } from '../../hooks/useSolarData';

export const Header = ({ onToggleSidebar }) => {
  const { isLiveConnected, latestTelemetry, selectedPlant } = useSolarData();
  const irradiancePoa = latestTelemetry?.irradiancePoa ?? 850;

  return (
    <header className="sm-top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="sm-icon-btn"
          aria-label="Toggle navigation sidebar"
          style={{ display: 'inline-flex' }}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusIndicator
            status={isLiveConnected ? 'ONLINE' : 'OFFLINE'}
            label={isLiveConnected ? `${selectedPlant?.name || 'Inverter'} Live` : 'Connecting...'}
            pulse={isLiveConnected}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Network & Low-Bandwidth Sync Status */}
        <SyncStatusIndicator />

        {/* Global Language Selector */}
        <LanguageSelector compact={false} />

        <div
          className="hidden lg:flex"
          style={{
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-subtle)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <SunMedium size={14} color="var(--color-accent-amber)" />
          <span>POA Irradiance: <strong>{irradiancePoa} W/m²</strong></span>
        </div>

        {/* System Notifications Dropdown */}
        <NotificationMenu />

        {/* Platform / Profile Menu */}
        <ProfileMenu />
      </div>
    </header>
  );
};

export default Header;
