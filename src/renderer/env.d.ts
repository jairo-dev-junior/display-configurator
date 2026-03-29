import type { AppStatePayload } from '../shared/profile-schema';

type SetValuePayload = {
  bus: string;
  hexCode: string;
  value: number;
};

type CreateProfilePayload = {
  profileName: string;
  bus: string;
  notes?: string;
};

type ApplyProfilePayload = {
  profileName: string;
  bus: string;
};

declare global {
  interface Window {
    monitorControl: {
      bootstrap: () => Promise<AppStatePayload>;
      refresh: () => Promise<AppStatePayload>;
      setValues: (payload: { bus: string; values: Array<{ hexCode: string; value: number }> }) => Promise<AppStatePayload>;
      setValue: (payload: SetValuePayload) => Promise<AppStatePayload>;
      createProfile: (payload: CreateProfilePayload) => Promise<AppStatePayload>;
      applyProfile: (payload: ApplyProfilePayload) => Promise<AppStatePayload>;
      importProfile: () => Promise<AppStatePayload>;
      exportProfile: (profileName: string) => Promise<boolean>;
    };
  }
}

export {};
