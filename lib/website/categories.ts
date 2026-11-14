/**
 * Starting categories for the public website (primepublic).
 *
 * Admins manage the real list from the products page; it is stored in the
 * WebsiteCategory collection (see lib/website/category-store.ts). This list is
 * only what a new installation starts with, until an admin first opens the
 * category manager.
 */
export const DEFAULT_WEBSITE_CATEGORIES = [
  { slug: "lighting", name: "Lighting", description: "LED lamps, tubes, panels and outdoor fittings." },
  { slug: "cables-wires", name: "Cables & wires", description: "Building wire, flexible and armoured cable." },
  { slug: "switches-sockets", name: "Switches & sockets", description: "Wall switches, socket outlets and plugs." },
  { slug: "circuit-protection", name: "Circuit protection", description: "Breakers, residual-current and surge devices." },
  { slug: "distribution-boards", name: "Distribution boards", description: "Consumer units and enclosures." },
  { slug: "conduits-trunking", name: "Conduits & trunking", description: "Conduit, trunking and boxes for cable routing." },
  { slug: "accessories", name: "Accessories", description: "Lugs, glands, ties, tape and earthing." },
] as const

/** Limits for admin-managed website categories. */
export const WEBSITE_CATEGORY_LIMITS = {
  maxCategories: 30,
  nameLength: 60,
  descriptionLength: 160,
} as const

/** Limits shared by the upload routes, the validator and the dialog. */
export const WEBSITE_IMAGE_LIMITS = {
  maxImages: 6,
  maxBytes: 5 * 1024 * 1024,
  contentTypes: ["image/webp", "image/jpeg", "image/png"],
} as const
