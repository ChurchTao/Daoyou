export const AUTH_LAYOUT_ROUTE_ID = 'auth-layout';
export const GAME_ROUTE_ID = 'game-root';

export interface AuthLoaderData {
  announcement: string | null;
}

export interface UserLoaderData {
  userId: string;
}

export interface AdminLoaderData {
  adminEmail: string;
}
