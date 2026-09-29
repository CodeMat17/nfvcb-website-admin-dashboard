import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { profileEntry } from "./schema";
import { deleteProfileImage, mediaFields } from "./lib/media";

const MAX_SHORT = 200;
const MAX_LONG = 5000;
const MAX_ITEMS = 50;

function clean(value: string, maxLen: number): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .slice(0, maxLen);
}

function required(value: string, maxLen: number, label: string): string {
  const out = clean(value, maxLen);
  if (!out) throw new Error(`${label} is required.`);
  return out;
}

function cleanList(values: string[], maxLen: number): string[] {
  return values.map((s) => clean(s, maxLen)).filter(Boolean).slice(0, MAX_ITEMS);
}

/** Cleans every string field of each row and drops rows whose `key` field ends up empty. */
function cleanRows<T extends Record<string, string | undefined>>(
  rows: T[],
  key: keyof T,
  maxLen: number,
): T[] {
  return rows
    .map((row) => {
      const out: Record<string, string | undefined> = {};
      for (const [k, val] of Object.entries(row)) {
        if (val === undefined) continue;
        const c = clean(val, maxLen);
        if (c) out[k] = c;
      }
      return out as T;
    })
    .filter((row) => Boolean(row[key]))
    .slice(0, MAX_ITEMS);
}

const profileFields = {
  name: v.string(),
  shortName: v.string(),
  role: v.string(),
  office: v.string(),
  postNominals: v.string(),
  email: v.string(),
  headOffice: v.string(),
  highlights: v.array(v.string()),
  appointment: v.array(v.object({ label: v.string(), value: v.string() })),
  vision: v.string(),
  bio: v.array(v.string()),
  expertise: v.array(v.string()),
  achievements: v.array(v.object({ title: v.string(), body: v.string() })),
  education: v.array(profileEntry),
  career: v.array(profileEntry),
  industryRoles: v.array(profileEntry),
  programmes: v.array(profileEntry),
  awards: v.array(profileEntry),
  publications: v.array(profileEntry),
  quotes: v.array(v.object({ text: v.string(), context: v.string() })),
  foreword: v.string(),
};

/** The profile, or null if it has not been created yet. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const ed = await ctx.db.query("executiveDirector").first();
    if (!ed) return null;
    return {
      ...ed,
      imageUrl: ed.imageUrl ?? (ed.imageId ? await ctx.storage.getUrl(ed.imageId) : null),
    };
  },
});

/** Creates the profile on first save, replaces it afterwards. */
export const save = mutation({
  args: {
    ...profileFields,
    // Cloudinary public ID from an upload signed by cloudinary.signUpload.
    imagePublicId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    const doc = {
      name: required(args.name, MAX_SHORT, "Name"),
      shortName: required(args.shortName, MAX_SHORT, "Short name"),
      role: required(args.role, MAX_SHORT, "Role"),
      office: clean(args.office, MAX_SHORT),
      postNominals: clean(args.postNominals, MAX_SHORT),
      email: clean(args.email, MAX_SHORT),
      headOffice: clean(args.headOffice, MAX_SHORT),
      highlights: cleanList(args.highlights, MAX_SHORT),
      appointment: cleanRows(args.appointment, "label", MAX_SHORT),
      vision: clean(args.vision, MAX_LONG),
      bio: cleanList(args.bio, MAX_LONG),
      expertise: cleanList(args.expertise, MAX_SHORT),
      achievements: cleanRows(args.achievements, "title", MAX_LONG),
      education: cleanRows(args.education, "title", MAX_SHORT),
      career: cleanRows(args.career, "title", MAX_SHORT),
      industryRoles: cleanRows(args.industryRoles, "title", MAX_SHORT),
      programmes: cleanRows(args.programmes, "title", MAX_SHORT),
      awards: cleanRows(args.awards, "title", MAX_SHORT),
      publications: cleanRows(args.publications, "title", MAX_SHORT),
      quotes: cleanRows(args.quotes, "text", MAX_LONG),
      foreword: clean(args.foreword, MAX_LONG),
    };

    const existing = await ctx.db.query("executiveDirector").first();
    let image = {
      imageUrl: existing?.imageUrl,
      imagePublicId: existing?.imagePublicId,
      imageId: existing?.imageId,
    };

    if (args.imagePublicId !== undefined) {
      const media = mediaFields(args.imagePublicId, "executive-director");
      if (existing && media.publicId !== existing.imagePublicId) {
        await deleteProfileImage(ctx, existing);
      }
      image = { imageUrl: media.url, imagePublicId: media.publicId, imageId: undefined };
    }

    if (existing) {
      await ctx.db.replace(existing._id, { ...doc, ...image });
      return existing._id;
    }
    return await ctx.db.insert("executiveDirector", { ...doc, ...image });
  },
});

/**
 * One-off: creates the profile from the content the public site used to hardcode.
 * Run with `npx convex run executiveDirector:seed`. Does nothing if a profile exists.
 * The photo is not included; upload it from the dashboard.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("executiveDirector").first())
      return "executiveDirector already exists; skipped.";

    await ctx.db.insert("executiveDirector", {
      name: "Dr. Shaibu Husseini, PhD",
      shortName: "Dr. Shaibu Husseini",
      role: "Executive Director / Director-General",
      office: "National Film and Video Censors Board",
      postNominals: "PhD, MNIPR, RPAFT, AFGO, ND",
      email: "dgoffice@nfvcb.gov.ng",
      headOffice: "Room B913, Federal Secretariat Complex Phase II, Abuja FCT",
      highlights: [
        "Chair, AMAA Selection Committee (16 yrs)",
        "Oxford Blavatnik Alumni",
        "Golden Globes Voter",
      ],
      appointment: [
        { label: "Appointed", value: "12 January 2024, by President Bola Ahmed Tinubu" },
        { label: "Assumed office", value: "6 March 2024" },
      ],
      vision:
        "Nigeria's film regulatory framework can rank among the best in the world. We have the talent, the legislation, and now the strategy. NFVCB is determined to reduce bureaucracy, embrace technology, and make our services accessible to every stakeholder across Nigeria.",
      bio: [
        "Dr. Shaibu Husseini, widely known as “Mr. Nollywood”, is the Executive Director/CEO of the National Film and Video Censors Board. He was appointed on 12 January 2024 by President Bola Ahmed Tinubu and assumed office on 6 March 2024.",
        "A culture journalist, film critic and scholar, he spent more than three decades at The Guardian Nigeria, rising to Editor-at-Large on the Culture, Theatre & Film desk. He is a Senior Teaching & Research Fellow in the Department of Mass Communication, University of Lagos, where he earned his MSc (Distinction) and a PhD with a doctoral thesis on the structure of film production companies in Nollywood.",
        "He has chaired the Africa Movie Academy Awards (AMAA) Selection Committee for 16 consecutive years, is an international voting member of the Golden Globe Awards, and has served as an official consultant to the Berlin International Film Festival. At NFVCB he has moved the Board from a censorship posture to a progressive classification model and led the full digitalisation of its classification operations.",
      ],
      expertise: [
        "Film Policy & Regulation",
        "Film Criticism & Curation",
        "Nollywood Documentation",
        "Creative Economy Development",
        "Cultural Administration",
        "Theatre & Performing Arts",
        "Journalism & Broadcasting",
        "Public Relations & Advertising",
        "Mass Communication",
      ],
      achievements: [
        { title: "From censorship to classification", body: "Shifted the Board's institutional approach from censorship to a progressive classification model." },
        { title: "Fully digital operations", body: "Led the full digitalisation of all NFVCB classification operations." },
        { title: "Content standards campaign", body: "Launched a nationwide, NGO-backed campaign addressing harmful depictions on screen." },
        { title: "A national workforce", body: "Empowered 465 staff across 6 zonal offices and 26 state centres." },
        { title: "Nigerian films at the box office", body: "Facilitated a period in which Nigerian films outperformed foreign titles at the local box office." },
        { title: "Industry collaboration", body: "Deepened engagement with producers, skit makers, cinema operators and partner agencies." },
        { title: "Anti-piracy partnership", body: "Partnered with the Nigerian Communications Commission (NCC) on anti-piracy initiatives." },
        { title: "Sub-national film infrastructure", body: "Pledged technical support to the development of the Ekiti State Film Village." },
      ],
      education: [
        { title: "PhD, Mass Communication", org: "University of Lagos", note: "Thesis: “Structure of Film Production Companies in Nollywood”" },
        { title: "MSc, Mass Communication", org: "University of Lagos", note: "Distinction" },
        { title: "BSc, Mass Communication", org: "Lagos State University", note: "First Class" },
      ],
      career: [
        { title: "Executive Director / CEO", org: "National Film and Video Censors Board", note: "2024 – present" },
        { title: "Editor-at-Large, Culture, Theatre & Film", org: "The Guardian Nigeria", note: "30+ years" },
        { title: "Senior Teaching & Research Fellow", org: "Department of Mass Communication, University of Lagos" },
        { title: "Director of Dance & Music; Head, Strategic Communication Unit", org: "National Troupe of Nigeria" },
        { title: "Secretary, Governing Board", org: "National Theatre / National Troupe", note: "2011 – 2015" },
        { title: "Special Assistant to the Director General", org: "National Theatre / National Troupe" },
        { title: "Pioneer Artiste & Member", org: "National Dance Troupe of Nigeria" },
        { title: "Contributor / Broadcaster", org: "Mainland FM 98.3, Village Square Programme" },
      ],
      industryRoles: [
        { title: "International Voting Member", org: "Golden Globe Awards" },
        { title: "Official Consultant", org: "Berlin International Film Festival (Berlinale)" },
        { title: "Selection Committee Chair (16 consecutive years) & Jury Member", org: "Africa Movie Academy Awards (AMAA)" },
        { title: "Former Member", org: "Nigeria Oscar Selection Committee" },
        { title: "Board Member", org: "Mainframe Film Institute" },
        { title: "Board Member", org: "In-Short International Film Festival" },
        { title: "Board Member", org: "Bank of Industry Nollywood Fund" },
        { title: "Panelist, Creative Economy track", org: "NECLive 2025" },
      ],
      programmes: [
        { title: "AIG-Public Leaders Programme", org: "Blavatnik School of Governance, University of Oxford" },
        { title: "International Visitors Leadership Programme", org: "U.S. Department of State" },
      ],
      awards: [
        { title: "Fellow of the Theatre Profession (FTA)", org: "NANTAP, conferred at Glover Hall, Lagos", note: "22 February 2025" },
        { title: "Recognition Award", org: "Nollywood Film Festival, Germany", note: "2014" },
      ],
      publications: [
        { title: "Moviedom: The Nollywood Narratives", org: "Monograph chronicling Nollywood's formative era", note: "2010" },
        { title: "Three Decades of Film Classification", org: "NFVCB publication marking the Board's 30th anniversary", note: "2024" },
      ],
      quotes: [
        { text: "We should no longer be doing analogue at a time when we should be talking about digital.", context: "On institutional modernisation" },
        { text: "The Golden Globe appointment is the highest imprimatur for my career as a culture journalist and critic.", context: "On the Golden Globe appointment" },
        { text: "Since the reward for hard work is more work, I commit to continue working tirelessly to promote and advance the cause of theatre and film arts in Nigeria.", context: "On assuming office" },
      ],
      foreword:
        "In line with the Federal Government reform programme with respect to the services delivery contract, it is my pleasure to present this revised NFVCB Service Charter for clients of the board. Our goal is to ensure that NFVCB operates a world class film regulatory agency with established best practices and appropriate service standards.",
    });
    return "Inserted Executive Director profile.";
  },
});
