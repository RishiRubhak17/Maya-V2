import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Full Google Workspace scopes authorized for Maya
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
];

// Standard Google scopes compatible with personal @gmail.com and external mail IDs
// (omits Workspace-org-only Chat and Meet creation scopes that block personal accounts)
export const STANDARD_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

export type GoogleScopeMode = 'basic' | 'standard' | 'full';

export interface GoogleSignInOptions {
  scopeMode?: GoogleScopeMode;
  loginHint?: string;
}

export interface GoogleSignInResult {
  user: User;
  accessToken: string;
  scopeMode: GoogleScopeMode;
  hasWorkspaceToken: boolean;
}

// Initialize Firebase App instance once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Memory-only access token cache (MANDATORY: NEVER in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let activeScopeMode: GoogleScopeMode | null = null;
let isSigningIn = false;

const createGoogleProvider = (scopeMode: GoogleScopeMode, loginHint?: string): GoogleAuthProvider => {
  const googleProvider = new GoogleAuthProvider();

  if (scopeMode === 'full') {
    WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));
  } else if (scopeMode === 'standard') {
    STANDARD_WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));
  } else {
    // Universal Google Sign-In: basic profile & email works for ALL Google/Gmail mail IDs
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  }

  // Always allow selecting any mail ID (no 'hd' domain restriction)
  const customParams: Record<string, string> = {
    prompt: scopeMode === 'basic' ? 'select_account' : 'select_account consent',
    access_type: 'online',
  };

  if (loginHint && loginHint.trim()) {
    customParams.login_hint = loginHint.trim();
  }

  googleProvider.setCustomParameters(customParams);
  return googleProvider;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Allow any authenticated Google mail ID to stay logged in even before Workspace API scopes are granted
      if (!isSigningIn) {
        onAuthSuccess?.(user, cachedAccessToken || '');
      }
    } else {
      cachedAccessToken = null;
      activeScopeMode = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (
  options: GoogleSignInOptions = {}
): Promise<GoogleSignInResult | null> => {
  const { scopeMode = 'basic', loginHint } = options;

  try {
    isSigningIn = true;
    const previousEmail = auth.currentUser?.email;
    const googleProvider = createGoogleProvider(scopeMode, loginHint);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';

    if (scopeMode !== 'basic' && accessToken) {
      cachedAccessToken = accessToken;
      activeScopeMode = scopeMode;
    } else {
      // Preserve any existing workspace token only if signing in with the same email; otherwise reset
      if (previousEmail && previousEmail !== result.user.email) {
        cachedAccessToken = null;
      }
      activeScopeMode = cachedAccessToken ? activeScopeMode : 'basic';
    }

    return {
      user: result.user,
      accessToken: cachedAccessToken || accessToken,
      scopeMode: activeScopeMode || scopeMode,
      hasWorkspaceToken: Boolean(cachedAccessToken),
    };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      // User cancelled or closed the sign-in popup - gracefully return null without error
      return null;
    }
    console.error('[Google Auth] Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const hasWorkspaceAccessToken = (): boolean => {
  return Boolean(cachedAccessToken);
};

export const getActiveScopeMode = (): GoogleScopeMode | null => {
  return activeScopeMode;
};

export const setAccessTokenInMemory = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    activeScopeMode = null;
  }
};
