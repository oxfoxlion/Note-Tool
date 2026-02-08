import axios from 'axios';
import { API_BASE } from './api';

const api = axios.create({
  baseURL: API_BASE,
});

function authHeaders() {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('NO_TOKEN');
  }
  return { Authorization: `Bearer ${token}` };
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
};

export type Board = {
  id: number;
  user_id: string;
  name: string;
  created_at: string;
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

export async function updateBoardCardPosition(boardId: number, cardId: number, payload: { x_pos: number; y_pos: number }) {
  const { data } = await api.put(`/note_tool/board/${boardId}/cards/${cardId}`, payload, {
    headers: authHeaders(),
  });
  return data as { board_id: number; card_id: number; x_pos: number; y_pos: number };
}

export async function addExistingCardToBoard(boardId: number, cardId: number) {
  const { data } = await api.post(`/note_tool/board/${boardId}/cards/${cardId}`, {}, { headers: authHeaders() });
  return data as { board_id: number; card_id: number; x_pos: number; y_pos: number };
}

export async function removeCardFromBoard(boardId: number, cardId: number) {
  await api.delete(`/note_tool/board/${boardId}/cards/${cardId}`, { headers: authHeaders() });
}

export async function getUserSettings(): Promise<UserSettings> {
  const { data } = await api.get('/note_tool/user/settings', { headers: authHeaders() });
  return data;
}

export async function updateUserSettings(payload: Partial<UserSettings>) {
  const { data } = await api.put('/note_tool/user/settings', payload, { headers: authHeaders() });
  return data as UserSettings;
}
