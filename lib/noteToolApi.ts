import axios from 'axios';
import { API_BASE } from './api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

type RetryableRequestConfig = {
  _retry?: boolean;
  headers?: Record<string, string>;
  url?: string;
};

function readAccessToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('note_tool_token') || '';
  } catch (error) {
    console.warn('Failed to read auth token:', error);
    return '';
  }
}

function writeAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('note_tool_token', token);
  } catch (error) {
    console.warn('Failed to write auth token:', error);
  }
}

function clearAccessToken() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('note_tool_token');
  } catch (error) {
    console.warn('Failed to clear auth token:', error);
  }
}

function clearAuthLocalState() {
  if (typeof window === 'undefined') return;
  clearAccessToken();
  try {
    localStorage.removeItem('userId');
  } catch (error) {
    console.warn('Failed to clear user state:', error);
  }
}

let hasHandledAuthExpired = false;

function handleAuthExpired() {
  if (typeof window === 'undefined' || hasHandledAuthExpired) return;
  hasHandledAuthExpired = true;
  clearAuthLocalState();
  const isAuthPage = window.location.pathname.startsWith('/auth/');
  if (!isAuthPage) {
    window.alert('登入已過期，請重新登入。');
  }
  window.location.assign('/auth/login');
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = api
    .post('/note_tool/auth/refresh')
    .then((response) => {
      const nextToken = response.data?.token;
      if (!nextToken || typeof nextToken !== 'string') {
        throw new Error('Refresh token response missing token');
      }
      writeAccessToken(nextToken);
      return nextToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = (error?.config || {}) as RetryableRequestConfig;
    const isRefreshRequest = (originalRequest.url || '').includes('/note_tool/auth/refresh');

    if (status === 401 && !isRefreshRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const nextToken = await refreshAccessToken();
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${nextToken}`,
        };
        return api.request(originalRequest);
      } catch {
        handleAuthExpired();
        return Promise.reject(new Error('UNAUTHORIZED'));
      }
    }

    if (status === 401) {
      handleAuthExpired();
      return Promise.reject(new Error('UNAUTHORIZED'));
    }
    return Promise.reject(error);
  }
);

function authHeaders() {
  const token = readAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type Card = {
  id: number;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at?: string;
  x_pos?: number;
  y_pos?: number;
  width?: number | null;
  height?: number | null;
};

export type Board = {
  id: number;
  user_id: string;
  name: string;
  description?: string | null;
  tags?: string[];
  created_at: string;
  card_count?: number;
};

export type BoardSummary = {
  id: number;
  name: string;
};

export type BoardRegion = {
  id: number;
  board_id: number;
  name: string;
  color: string;
  x_pos: number;
  y_pos: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
};

export type BoardShareLink = {
  id: number;
  board_id: number;
  token: string;
  permission: 'read' | 'edit';
  expires_at: string | null;
  revoked_at: string | null;
  password_protected?: boolean;
  created_by: string;
  created_at: string;
};

export type CardShareLink = {
  id: number;
  card_id: number;
  token: string;
  permission: 'read' | 'edit';
  expires_at: string | null;
  revoked_at: string | null;
  password_protected?: boolean;
  created_by: string;
  created_at: string;
};

export type SharedMetaPayload = {
  isPasswordProtected: boolean;
  title: string;
  description: string;
};

export type SharedBoardPayload = {
  board: Board;
  cards: Card[];
  regions: BoardRegion[];
  share: {
    permission: 'read' | 'edit';
    expires_at: string | null;
  };
};

export type SharedCardPayload = {
  card: Card;
  share: {
    permission: 'read' | 'edit';
    expires_at: string | null;
  };
};

export type UserSettings = {
  cardOpenMode: 'modal' | 'sidepanel';
  cardPreviewLength: number;
  theme?: 'light';
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  twoFactorEnabled: boolean;
};

export async function getCards(): Promise<Card[]> {
  const { data } = await api.get('/note_tool/card/', { headers: authHeaders() });
  return data;
}

export async function createCard(payload: { title: string; content?: string }) {
  const { data } = await api.post('/note_tool/card/', payload, { headers: authHeaders() });
  return data as Card;
}

export async function updateCard(cardId: number, payload: { title: string; content?: string }) {
  const { data } = await api.put(`/note_tool/card/${cardId}`, payload, { headers: authHeaders() });
  return data as Card;
}

export async function deleteCard(cardId: number) {
  await api.delete(`/note_tool/card/${cardId}`, { headers: authHeaders() });
}

export async function getCardShareLinks(cardId: number): Promise<CardShareLink[]> {
  const { data } = await api.get(`/note_tool/card/${cardId}/share-links`, { headers: authHeaders() });
  return data;
}

export async function getCardBoards(cardId: number): Promise<BoardSummary[]> {
  const { data } = await api.get(`/note_tool/card/${cardId}/boards`, { headers: authHeaders() });
  return data;
}

export async function createCardShareLink(
  cardId: number,
  payload?: { permission?: 'read' | 'edit'; expires_in_days?: number; password?: string }
) {
  const { data } = await api.post(`/note_tool/card/${cardId}/share-links`, payload ?? {}, {
    headers: authHeaders(),
  });
  return data as CardShareLink;
}

export async function revokeCardShareLink(cardId: number, shareLinkId: number) {
  await api.delete(`/note_tool/card/${cardId}/share-links/${shareLinkId}`, { headers: authHeaders() });
}

export async function getSharedCardByToken(token: string): Promise<SharedCardPayload> {
  const { data } = await api.get(`/note_tool/card/share/${encodeURIComponent(token)}`);
  return data;
}

export async function unlockSharedCard(token: string, password: string) {
  const { data } = await api.post(`/note_tool/card/share/${encodeURIComponent(token)}/unlock`, { password });
  return data as { success: boolean };
}

export async function getSharedCardMeta(token: string): Promise<SharedMetaPayload> {
  const { data } = await api.get(`/note_tool/card/share/${encodeURIComponent(token)}/meta`);
  return data;
}

export async function getBoards(): Promise<Board[]> {
  const { data } = await api.get('/note_tool/board/', { headers: authHeaders() });
  return data;
}

export async function createBoard(payload: { name: string; description?: string }) {
  const { data } = await api.post('/note_tool/board/', payload, { headers: authHeaders() });
  return data as Board;
}

export async function updateBoard(boardId: number, payload: { name: string; tags?: string[]; description?: string }) {
  const { data } = await api.put(`/note_tool/board/${boardId}`, payload, { headers: authHeaders() });
  return data as Board;
}

export async function deleteBoard(boardId: number) {
  await api.delete(`/note_tool/board/${boardId}`, { headers: authHeaders() });
}

export async function getBoard(boardId: number) {
  const { data } = await api.get(`/note_tool/board/${boardId}`, { headers: authHeaders() });
  return data as { board: Board; cards: Card[] };
}

export async function createCardInBoard(boardId: number, payload: { title: string; content?: string }) {
  const { data } = await api.post(`/note_tool/board/${boardId}/cards`, payload, {
    headers: authHeaders(),
  });
  return data as { card: Card; boardCard: { board_id: number; card_id: number; x_pos: number; y_pos: number } };
}

export async function updateBoardCardPosition(
  boardId: number,
  cardId: number,
  payload: { x_pos?: number | null; y_pos?: number | null; width?: number | null; height?: number | null }
) {
  const { data } = await api.put(`/note_tool/board/${boardId}/cards/${cardId}`, payload, {
    headers: authHeaders(),
  });
  return data as { board_id: number; card_id: number; x_pos: number; y_pos: number; width?: number | null; height?: number | null };
}

export async function addExistingCardToBoard(boardId: number, cardId: number) {
  const { data } = await api.post(`/note_tool/board/${boardId}/cards/${cardId}`, {}, { headers: authHeaders() });
  return data as { board_id: number; card_id: number; x_pos: number; y_pos: number };
}

export async function removeCardFromBoard(boardId: number, cardId: number) {
  await api.delete(`/note_tool/board/${boardId}/cards/${cardId}`, { headers: authHeaders() });
}

export async function getBoardRegions(boardId: number): Promise<BoardRegion[]> {
  const { data } = await api.get(`/note_tool/board/${boardId}/regions`, { headers: authHeaders() });
  return data;
}

export async function createBoardRegion(
  boardId: number,
  payload: { name: string; color?: string; x_pos: number; y_pos: number; width: number; height: number }
) {
  const { data } = await api.post(`/note_tool/board/${boardId}/regions`, payload, {
    headers: authHeaders(),
  });
  return data as BoardRegion;
}

export async function updateBoardRegion(
  boardId: number,
  regionId: number,
  payload: { name?: string; color?: string; x_pos?: number; y_pos?: number; width?: number; height?: number }
) {
  const { data } = await api.put(`/note_tool/board/${boardId}/regions/${regionId}`, payload, {
    headers: authHeaders(),
  });
  return data as BoardRegion;
}

export async function deleteBoardRegion(boardId: number, regionId: number) {
  await api.delete(`/note_tool/board/${boardId}/regions/${regionId}`, { headers: authHeaders() });
}

export async function getBoardShareLinks(boardId: number): Promise<BoardShareLink[]> {
  const { data } = await api.get(`/note_tool/board/${boardId}/share-links`, { headers: authHeaders() });
  return data;
}

export async function createBoardShareLink(
  boardId: number,
  payload?: { permission?: 'read' | 'edit'; expires_in_days?: number; password?: string }
) {
  const { data } = await api.post(`/note_tool/board/${boardId}/share-links`, payload ?? {}, {
    headers: authHeaders(),
  });
  return data as BoardShareLink;
}

export async function revokeBoardShareLink(boardId: number, shareLinkId: number) {
  await api.delete(`/note_tool/board/${boardId}/share-links/${shareLinkId}`, { headers: authHeaders() });
}

export async function getSharedBoardByToken(token: string): Promise<SharedBoardPayload> {
  const { data } = await api.get(`/note_tool/board/share/${encodeURIComponent(token)}`);
  return data;
}

export async function unlockSharedBoard(token: string, password: string) {
  const { data } = await api.post(`/note_tool/board/share/${encodeURIComponent(token)}/unlock`, { password });
  return data as { success: boolean };
}

export async function getSharedBoardMeta(token: string): Promise<SharedMetaPayload> {
  const { data } = await api.get(`/note_tool/board/share/${encodeURIComponent(token)}/meta`);
  return data;
}

export async function getUserSettings(): Promise<UserSettings> {
  const { data } = await api.get('/note_tool/user/settings', { headers: authHeaders() });
  return data;
}

export async function updateUserSettings(payload: Partial<UserSettings>) {
  const { data } = await api.put('/note_tool/user/settings', payload, { headers: authHeaders() });
  return data as UserSettings;
}

export async function getUserProfile(): Promise<UserProfile> {
  const { data } = await api.get('/note_tool/user/profile', { headers: authHeaders() });
  return data;
}

export async function disableTwoFactorAuth() {
  const { data } = await api.post('/note_tool/auth/2fa/disable', {}, { headers: authHeaders() });
  return data as { message: string; twoFactorEnabled: boolean };
}
