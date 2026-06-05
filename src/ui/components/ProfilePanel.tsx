/**
 * ProfilePanel — Save, load, and delete search profiles.
 *
 * Connected to profile-store for localStorage persistence.
 * Shown on each category page as a collapsible panel.
 */
import { useState, useMemo } from 'react';
import { useProfileStore } from '@store/profile-store';

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

  const handleSave = () => {
    if (!profileName.trim()) return;
    saveProfile(profileName.trim(), category, currentFilterData);
    setProfileName('');
  };

  const handleRestore = (filterData: Record<string, unknown>) => {
    onRestore(filterData);
  };

  const handleDelete = (id: string) => {
    deleteProfile(id);
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleFinishRename = (id: string) => {
    if (editName.trim()) {
      renameProfile(id, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
        aria-expanded={expanded}
        aria-controls="profile-panel-content"
      >
        <span className="text-xs text-gray-400">Профили</span>
        <span className="text-xs text-gray-600" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2" id="profile-panel-content">
          {/* Save new profile */}
          <div className="flex gap-2">
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Имя профиля..."
              aria-label="Имя нового профиля"
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <button
              onClick={handleSave}
              disabled={!profileName.trim()}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                profileName.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Сохранить
            </button>
          </div>

          {/* Saved profiles list */}
          {profiles.length === 0 ? (
            <div className="text-[10px] text-gray-600">Нет сохранённых профилей</div>
          ) : (
            <div className="flex flex-col gap-1">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 p-1.5 bg-gray-800 rounded"
                >
                  {editingId === profile.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleFinishRename(profile.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(profile.id); }}
                      className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-500 rounded text-xs text-white focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => handleRestore(profile.filterData)}
                      className="flex-1 text-left text-xs text-blue-400 hover:text-blue-300 truncate"
                      title={`Загрузить: ${profile.name}`}
                    >
                      {profile.name}
                    </button>
                  )}

                  <button
                    onClick={() => handleStartRename(profile.id, profile.name)}
                    className="text-[10px] text-gray-500 hover:text-gray-300 px-1"
                    title="Переименовать"
                  >
                    ✎
                  </button>

                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="text-[10px] text-gray-500 hover:text-red-400 px-1"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
