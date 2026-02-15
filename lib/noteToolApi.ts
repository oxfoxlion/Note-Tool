import axios from 'axios';
import { API_BASE } from './api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      return Promise.reject(new Error('UNAUTHORIZED'));
    }
    return Promise.reject(error);
  }
);

function authHeaders() {
  if (typeof window === 'undefined') return {};
  let token = '';
  try {
    token = localStorage.getItem('note_tool_token') || '';
  } catch (error) {
    console.warn('Failed to read auth token:', error);
  }
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
  tags?: string[];
  created_at: string;
  card_count?: number;
};

export type BoardRegion = {
  id: number;
  board_id: number;
  name: string;
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
  created_by: string;
  created_at: string;
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

export type UserSettings = {
  cardOpenMode: 'modal' | 'sidepanel';
  cardPreviewLength: number;
  theme?: 'light';
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

export async function getBoards(): Promise<Board[]> {
  const { data } = await api.get('/note_tool/board/', { headers: authHeaders() });
  return data;
}

export async function createBoard(payload: { name: string }) {
  const { data } = await api.post('/note_tool/board/', payload, { headers: authHeaders() });
  return data as Board;
}

export async function updateBoard(boardId: number, payload: { name: string; tags?: string[] }) {
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
  payload: { name: string; x_pos: number; y_pos: number; width: number; height: number }
) {
  const { data } = await api.post(`/note_tool/board/${boardId}/regions`, payload, {
    headers: authHeaders(),
  });
  return data as BoardRegion;
}

export async function updateBoardRegion(
  boardId: number,
  regionId: number,
  payload: { name?: string; x_pos?: number; y_pos?: number; width?: number; height?: number }
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
  payload?: { permission?: 'read' | 'edit'; expires_in_days?: number }
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

export async function getUserSettings(): Promise<UserSettings> {
  const { data } = await api.get('/note_tool/user/settings', { headers: authHeaders() });
  return data;
}

export async function updateUserSettings(payload: Partial<UserSettings>) {
  const { data } = await api.put('/note_tool/user/settings', payload, { headers: authHeaders() });
  return data as UserSettings;
}
