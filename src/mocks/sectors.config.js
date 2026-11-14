export const SECTORS_CONFIG = Object.freeze([
  { id: 'A', nome: 'Setor A', capacidade: 40, distanciaEntrada: 20 },
  { id: 'B', nome: 'Setor B', capacidade: 35, distanciaEntrada: 35 },
  { id: 'C', nome: 'Setor C', capacidade: 50, distanciaEntrada: 60 },
  { id: 'D', nome: 'Setor D', capacidade: 45, distanciaEntrada: 75 },
  { id: 'E', nome: 'Setor E', capacidade: 60, distanciaEntrada: 100 },
  { id: 'F', nome: 'Setor F', capacidade: 55, distanciaEntrada: 120 },
  { id: 'G', nome: 'Setor G', capacidade: 30, distanciaEntrada: 150 },
]);

export const ENTRY_POINT = 'ENTRADA';
export const EXIT_POINT = 'SAIDA';

export const SECTOR_CONNECTIONS = Object.freeze([
  [ENTRY_POINT, 'A'],
  [ENTRY_POINT, 'B'],
  ['A', 'B'],
  ['A', 'C'],
  ['B', 'D'],
  ['C', 'D'],
  ['C', 'E'],
  ['D', 'F'],
  ['E', 'F'],
  ['E', 'G'],
  ['F', 'G'],
  ['A', EXIT_POINT],
  ['B', EXIT_POINT],
]);
