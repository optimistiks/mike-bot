export const REGISTERED_PERSONA_ID = 101;
export const UNREGISTERED_PERSONA_ID = 104;
export const FORBIDDEN_PERSONA_ID = 105;

export const DEFAULT_SEED_PERSONA = "registered";

export const SEED_PERSONAS = {
  registered: {
    userId: REGISTERED_PERSONA_ID,
    firstName: "Alice",
    username: "alice",
    displayName: "@alice",
  },
  unregistered: {
    userId: UNREGISTERED_PERSONA_ID,
    firstName: "Unregistered",
    username: "unregistered",
    displayName: "@unregistered",
  },
  forbidden: {
    userId: FORBIDDEN_PERSONA_ID,
    firstName: "Forbidden",
    username: "forbidden",
    displayName: "@forbidden",
  },
} as const;

export type SeedPersonaName = keyof typeof SEED_PERSONAS;
export type SeedPersona = (typeof SEED_PERSONAS)[SeedPersonaName];

export function resolveSeedPersona(
  name: string | null | undefined,
): SeedPersona | null {
  switch (name ?? DEFAULT_SEED_PERSONA) {
    case "registered":
      return SEED_PERSONAS.registered;
    case "unregistered":
      return SEED_PERSONAS.unregistered;
    case "forbidden":
      return SEED_PERSONAS.forbidden;
    default:
      return null;
  }
}
