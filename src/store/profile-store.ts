/**
 * Profile Store — Zustand store for search profiles.
 *
 * A profile is a saved set of filter selections that can be
 * quickly restored. Useful for repeated searches.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SearchProfile {
  id: string;
  name: string;
  category: string;
  createdAt: number;
  /** Serialized filter state */
  filterData: Record<string, unknown>;
}

export interface ProfileActions {
  /** Save current filters as a new profile */
  saveProfile: (name: string, category: string, filterData: Record<string, unknown>) => string;
  /** Load a profile by ID */
  loadProfile: (id: string) => SearchProfile | undefined;
  /** Delete a profile by ID */
  deleteProfile: (id: string) => void;
  /** Rename a profile */
  renameProfile: (id: string, name: string) => void;
  /** Get all profiles for a category */
  getProfilesByCategory: (category: string) => SearchProfile[];
}

export type ProfileStore = {
  profiles: Record<string, SearchProfile>;
} & ProfileActions;

/** Extract the counter from a profile ID like "profile_1718012345_3" → 3.
 *  Returns 0 if the ID format doesn't match. */
function extractCounter(id: string): number {
  const match = id.match(/^profile_\d+_(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Derive the next counter value from existing profile IDs.
 *  Scans all profile IDs and returns max(counter) + 1, or 1 if no profiles exist.
 *  This ensures IDs are always unique even after page reload (counter is not persisted). */
function deriveNextCounter(profiles: Record<string, SearchProfile>): number {
  const ids = Object.keys(profiles);
  if (ids.length === 0) return 1;
  return Math.max(...ids.map(extractCounter)) + 1;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: {},

      saveProfile: (name: string, category: string, filterData: Record<string, unknown>) => {
        const counter = deriveNextCounter(get().profiles);
        const id = `profile_${Date.now()}_${counter}`;
        const profile: SearchProfile = {
          id,
          name,
          category,
          createdAt: Date.now(),
          filterData,
        };
        set((state) => ({
          profiles: { ...state.profiles, [id]: profile },
        }));
        return id;
      },

      loadProfile: (id: string) => {
        return get().profiles[id];
      },

      deleteProfile: (id: string) => {
        set((state) => {
          const newProfiles = { ...state.profiles };
          delete newProfiles[id];
          return { profiles: newProfiles };
        });
      },

      renameProfile: (id: string, name: string) => {
        set((state) => {
          const profile = state.profiles[id];
          if (!profile) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...profile, name },
            },
          };
        });
      },

      getProfilesByCategory: (category: string) => {
        return Object.values(get().profiles)
          .filter((p) => p.category === category)
          .sort((a, b) => b.createdAt - a.createdAt);
      },
    }),
    {
      name: 'poe2-regex-profiles',
    }
  )
);
