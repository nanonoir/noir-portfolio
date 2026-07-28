export const ACTION_FORM_ACTIONS = {
  ACCEPT_PROPOSAL: "accept-proposal",
  CONFIRM: "confirm",
  DECLINE: "decline",
  PROPOSE: "propose",
} as const;

export type ActionFormAction = (typeof ACTION_FORM_ACTIONS)[keyof typeof ACTION_FORM_ACTIONS];

export const ACTION_TOKEN_ACTIONS = {
  ACCEPT_PROPOSAL: "accept_proposal",
  CONFIRM: "confirm",
  DECLINE: "decline",
  PROPOSE: "propose",
} as const;

export type ActionTokenAction = (typeof ACTION_TOKEN_ACTIONS)[keyof typeof ACTION_TOKEN_ACTIONS];
