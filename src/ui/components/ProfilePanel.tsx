/**
 * ProfilePanel — Save, load, and delete search profiles.
 *
 * Connected to profile-store for localStorage persistence.
 * Shown on each category page as a collapsible panel.
 *
 * Features:
 * - Delete confirmation: clicking ✕ enters confirm state (✕→✓),
 *   clicking ✓ confirms, clicking elsewhere cancels.
 * - Full ARIA labels on all action buttons.
 * - Keyboard accessible: Enter/Space on all interactive elements.
 */
import { useState, useMemo } from 'react';
import { useProfileStore } from '@store/profile-store';
import { t } from '@shared/i18n';

interface ProfilePanelProps {
  /** Current category ID (e.g., "waystone") */
  category: string;
  /** Current filter state serialized for saving */
  currentFilterData: Record<string, unknown>;
  /** Callback to restore filter state from a loaded profile */
  onRestore: (filterData: Record<string, unknown>) => void;
}

export function ProfilePanel({ category, currentFilterData, onRestore }: ProfilePanelProps) {
  // Select the profiles record (stable reference) and derive the filtered
  // list in useMemo. Using getProfilesByCategory directly as a selector
  // creates a new array on every call, which violates useSyncExternalStore's
  // contract (selector must return the same reference when data is unchanged),
  // causing an infinite re-render loop (React error #185).
  const allProfiles = useProfileStore(state => state.profiles);
  const saveProfile = useProfileStore(state => state.saveProfile);
  const deleteProfile = useProfileStore(state => state.deleteProfile);
  const renameProfile = useProfileStore(state => state.renameProfile);

  const profiles = useMemo(
    () => Object.values(allProfiles)
      .filter(p => p.category === category)
      .sort((a, b) => b.createdAt - a.createdAt),
    [allProfiles, category]
  );

  const [profileName, setProfileName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expanded, setExpanded] = useState(false);
  /** ID of the profile pending delete confirmation */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /** Check if a profile name already exists in this category */
  const isDuplicateName = useMemo(() => {
    const trimmed = profileName.trim().toLowerCase();
    if (!trimmed) return false;
    return profiles.some(p => p.name.toLowerCase() === trimmed);
  }, [profileName, profiles]);

  const handleSave = () => {
    const trimmed = profileName.trim();
    if (!trimmed || isDuplicateName) return;
    saveProfile(trimmed, category, currentFilterData);
    setProfileName('');
  };

  const handleRestore = (filterData: Record<string, unknown>) => {
    onRestore(filterData);
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleDeleteConfirm = (id: string) => {
    deleteProfile(id);
    setPendingDeleteId(null);
  };

  const handleDeleteCancel = () => {
    setPendingDeleteId(null);
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setPendingDeleteId(null); // cancel any pending delete
  };

  const handleFinishRename = (id: string) => {
    if (editName.trim()) {
      renameProfile(id, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="bg-panel border border-edge-panel rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
        aria-expanded={expanded}
        aria-controls="profile-panel-content"
      >
        <span className="text-xs text-muted">{t('profile.label')}</span>
        <span className="text-xs text-faint" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2" id="profile-panel-content">
          {/* Save new profile */}
          <div className="flex gap-2">
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={t('profile.add') + '...'}
              aria-label={t('profile.add')}
              className="flex-1 px-2 py-1 bg-surface border border-edge rounded text-xs text-bright placeholder-ghost-alt focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <button
              onClick={handleSave}
              disabled={!profileName.trim() || isDuplicateName}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                profileName.trim() && !isDuplicateName
                  ? 'bg-btn-primary text-bright hover:bg-btn-primary-hover'
                  : 'bg-raised text-dim cursor-not-allowed'
              }`}
              title={isDuplicateName ? t('profile.duplicate') : undefined}
            >
              {isDuplicateName ? t('profile.duplicate') : t('profile.add')}
            </button>
          </div>

          {/* Saved profiles list */}
          {profiles.length === 0 ? (
            <div className="text-[10px] text-faint">{t('profile.label')} — 0</div>
          ) : (
            <div className="flex flex-col gap-1" onBlur={handleDeleteCancel}>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 p-1.5 bg-surface rounded"
                >
                  {editingId === profile.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleFinishRename(profile.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(profile.id); if (e.key === 'Escape') { setEditingId(null); setEditName(''); } }}
                      className="flex-1 px-1 py-0.5 bg-raised border border-gray-500 rounded text-xs text-bright focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => handleRestore(profile.filterData)}
                      className="flex-1 text-left text-xs text-accent-blue hover:text-blue-300 truncate"
                      title={`Загрузить: ${profile.name}`}
                    >
                      {profile.name}
                    </button>
                  )}

                  <button
                    onClick={() => handleStartRename(profile.id, profile.name)}
                    className="text-[10px] text-dim hover:text-soft px-1"
                    title={t('profile.rename')}
                    aria-label={`${t('profile.rename')}: ${profile.name}`}
                  >
                    ✎
                  </button>

                  {pendingDeleteId === profile.id ? (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleDeleteConfirm(profile.id); }}
                      className="text-[10px] text-accent-red hover:text-accent-red-soft px-1 font-bold"
                      title={t('profile.delete')}
                      aria-label={`${t('profile.delete')}: ${profile.name}`}
                      autoFocus
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteRequest(profile.id)}
                      className="text-[10px] text-dim hover:text-accent-red px-1"
                      title={t('profile.delete')}
                      aria-label={`${t('profile.delete')}: ${profile.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
