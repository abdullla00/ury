import { StateCreator } from 'zustand';
import { AuthSlice } from './auth-slice';
import { getCombinedPosProfile, PosProfileCombined } from '../../lib/pos-profile-api';

interface RolePermission {
  name: string;
  owner: string;
  creation: string;
  modified: string;
  modified_by: string;
  docstatus: number;
  idx: number;
  role: string;
  parent: string;
  parentfield: string;
  parenttype: string;
  doctype: string;
}

export interface ConfigState {
  allowedRoles: string[];
  isLoading: boolean;
  error: string | null;
  hasAccess: boolean;
  posProfile: PosProfileCombined | null;
}

export interface ConfigActions {
  checkAccess: () => void;
  setAllowedRoles: (roles: string[]) => void;
  fetchPosProfile: (forceRefresh?: boolean) => Promise<void>;
}

export type ConfigSlice = ConfigState & ConfigActions;

const initialState: ConfigState = {
  allowedRoles: [],
  isLoading: false,
  error: null,
  hasAccess: false,
  posProfile: null,
};

export const createConfigSlice: StateCreator<
  ConfigSlice & AuthSlice,
  [],
  [],
  ConfigSlice
> = (set, get) => ({
  ...initialState,

  fetchPosProfile: async (_forceRefresh = false) => {
    try {
      set({ isLoading: true, error: null });

      const profile = await getCombinedPosProfile();

      sessionStorage.setItem('posProfile', JSON.stringify(profile));
      set({ posProfile: profile });

      // Extract and set allowed roles from the profile
      const allowedRoles = profile.role_allowed_for_billing?.map((role: RolePermission) => role.role) || [];
      get().setAllowedRoles(allowedRoles);
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  checkAccess: () => {
    const { user, allowedRoles } = get();

    if (!user || !user.roles) {
      set({ hasAccess: false });
      return;
    }

    if (user.name === "Administrator") {
      set({ hasAccess: true, error: null });
      return;
    }

    const uryPosRoles = ["URY Cashier", "URY Captain", "URY Manager", "System Manager"];
    const hasUryRole = user.roles.some((role) => uryPosRoles.includes(role));

    if (!allowedRoles.length) {
      set({
        hasAccess: hasUryRole,
        error: hasUryRole ? null : "You do not have permission to access this application.",
      });
      return;
    }

    const hasAccess = user.roles.some((role) => allowedRoles.includes(role));
    set({
      hasAccess,
      error: hasAccess ? null : "You do not have permission to access this application.",
    });
  },

  setAllowedRoles: (roles) => {
    set({ allowedRoles: roles });
    // After setting new roles, recheck access
    get().checkAccess();
  },
}); 