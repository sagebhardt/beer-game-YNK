// Client -> Server events
export const C2S = {
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
  SELECT_ROLE: "select-role",
  JOIN_ADMIN_DASHBOARD: "join-admin-dashboard",
  JOIN_ADMIN_GAME: "join-admin-game",
} as const;

// Server -> Client events
export const S2C = {
  PLAYER_JOINED: "player-joined",
  PLAYER_LEFT: "player-left",
  ROLE_SELECTED: "role-selected",
  GAME_STARTED: "game-started",
  ORDER_SUBMITTED: "order-submitted",
  ROUND_ADVANCED: "round-advanced",
  GAME_ENDED: "game-ended",
  LOBBY_STATE: "lobby-state",
  ADMIN_GAME_UPSERT: "admin-game-upsert",
  ADMIN_GAME_REMOVED: "admin-game-removed",
  ADMIN_GAME_DETAIL: "admin-game-detail",
  ERROR: "error",
} as const;
