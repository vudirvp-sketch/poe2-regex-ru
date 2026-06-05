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

let profileCounter = 0;

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: {},

      saveProfile: (name: string, category: string, filterData: Record<string, unknown>) => {
        const id = `profile_${Date.now()}_${++profileCounter}`;
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
