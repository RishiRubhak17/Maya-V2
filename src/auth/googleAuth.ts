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

// Full Google Workspace scopes authorized for Maya (one sign-in connects the entire Workspace)
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

// Standard Google Workspace scopes compatible with personal @gmail.com and external mail IDs
// (omits Workspace-org-only Chat and Meet creation scopes if restricted by personal account)
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

export interface GoogleSignInOptions {
  loginHint?: string;
}

export interface GoogleSignInResult {
  user: User;
  accessToken: string;
  hasWorkspaceToken: boolean;
}

// Initialize Firebase App instance once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Memory-only access token cache (MANDATORY: NEVER in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

type AuthStateListener = (user: User | null, accessToken: string) => void;
const authStateListeners = new Set<AuthStateListener>();

function notifyAuthListeners(user: User | null, token: string) {
  authStateListeners.forEach((listener) => {
    try {
      listener(user, token);
    } catch {
      // ignore listener errors
    }
  });
}

const createUnifiedGoogleProvider = (
  scopes: string[],
  loginHint?: string
): GoogleAuthProvider => {
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  scopes.forEach((scope) => googleProvider.addScope(scope));

  const customParams: Record<string, string> = {
    prompt: 'select_account consent',
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
  const listener: AuthStateListener = (user, token) => {
    if (user) {
      onAuthSuccess?.(user, token);
    } else {
      onAuthFailure?.();
    }
  };
  authStateListeners.add(listener);

  const unsubscribeFirebase = onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (!isSigningIn) {
        notifyAuthListeners(user, cachedAccessToken || '');
      }
    } else {
      cachedAccessToken = null;
      notifyAuthListeners(null, '');
    }
  });

  return () => {
    authStateListeners.delete(listener);
    unsubscribeFirebase();
  };
};

const isPopupCancelledError = (error: any): boolean => {
  return (
    error?.code === 'auth/popup-closed-by-user' ||
    error?.code === 'auth/cancelled-popup-request' ||
    Boolean(error?.message?.includes('popup-closed-by-user'))
  );
};

const isScopeCompatibilityError = (error: any): boolean => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    msg.includes('invalid_scope') ||
    msg.includes('access_denied') ||
    msg.includes('admin_policy_enforced') ||
    msg.includes('restricted') ||
    code.includes('invalid-credential')
  );
};

/**
 * Single unified Google Sign-In connecting the chosen mail ID to the entire
 * Google Workspace (Calendar, Drive, Sheets, Gmail, Docs, Slides, Tasks, Chat,
 * Forms, Meet, and Firebase Cloud Memory) in one step.
 */
export const googleSignIn = async (
  options: GoogleSignInOptions = {}
): Promise<GoogleSignInResult | null> => {
  const { loginHint } = options;

  const attemptSignIn = async (scopes: string[]) => {
    const googleProvider = createUnifiedGoogleProvider(scopes, loginHint);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    return { user: result.user, accessToken };
  };

  try {
    isSigningIn = true;

    let authResult: { user: User; accessToken: string };
    try {
      authResult = await attemptSignIn(WORKSPACE_SCOPES);
    } catch (primaryError: any) {
      if (isPopupCancelledError(primaryError)) {
        return null;
      }
      if (isScopeCompatibilityError(primaryError)) {
        // Automatic fallback for personal @gmail.com accounts where org-only Chat/Meet scopes are blocked
        authResult = await attemptSignIn(STANDARD_WORKSPACE_SCOPES);
      } else {
        throw primaryError;
      }
    }

    cachedAccessToken = authResult.accessToken || null;
    notifyAuthListeners(authResult.user, cachedAccessToken || '');

    return {
      user: authResult.user,
      accessToken: cachedAccessToken || '',
      hasWorkspaceToken: Boolean(cachedAccessToken),
    };
  } catch (error: any) {
    if (isPopupCancelledError(error)) {
      return null;
    }

    if (error?.code === 'auth/unauthorized-domain' && typeof window !== 'undefined') {
      const host = window.location.hostname;
      const enhanced = new Error(
        `Domain "${host}" is not authorized in Firebase Auth. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`
      );
      (enhanced as any).code = error.code;
      throw enhanced;
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

export const setAccessTokenInMemory = (token: string | null) => {
  cachedAccessToken = token;
  notifyAuthListeners(auth.currentUser, token || '');
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    notifyAuthListeners(null, '');
  }
};
