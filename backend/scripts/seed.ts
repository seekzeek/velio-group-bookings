// Loads the sample world: Sunset Kayaking on the Tagus hosted by Kemi with Ada's, Femi's and Ife's groups, nineteen other
// activities across eleven cities and every Explore filter, each in its own time zone and currency with three photos, two full
// ones, one in the holdout, and Ada's invites from the My invites screen. Dates are relative to today so the demo keeps working. Run with `npm run seed`. It wipes the target database first.

import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config.js'
import { prisma } from '../src/db.js'
import { deterministicUuid, deterministicUuidWhere } from '../src/lib/ids.js'
import { localToUtc } from '../src/lib/time.js'
import { activityBucket, isHoldout } from '../src/modules/flags/flags.js'
import { displayCode } from '../src/modules/invites/codes.js'
import { hmacContact, normalizeContact } from '../src/modules/invites/contacts.js'
import type { Category, Illustration, Platform, Rail } from '../src/generated/prisma/client.js'

const TZ = 'Africa/Lagos'
const now = new Date()
const HOUR = 3_600_000
const DAY = 24 * HOUR

const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR)
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
const inDays = (days: number) => new Date(now.getTime() + days * DAY)
const photosDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed-photos')

function nextSaturdayAfter(days: number) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + days)
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1)
  return d
}
function thursdayBefore(days: number) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() - 1)
  return d
}
function shift(date: Date, days: number) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
const localAt = (date: Date, time: string, tz = TZ) => localToUtc(`${date.toISOString().slice(0, 10)}T${time}`, tz)

const anchor = nextSaturdayAfter(8)

type UserKey =
  | 'kemi' | 'ada' | 'tunde' | 'chioma' | 'femi' | 'zara' | 'bisi' | 'leo' | 'ife' | 'dayo'
  | 'bayo' | 'musa' | 'tobi' | 'ngozi' | 'mira' | 'diego'
  | 'amara' | 'kunle' | 'lena' | 'mateo' | 'yuki' | 'sofia' | 'priya' | 'noah' | 'lucia'

const users: Record<UserKey, { name: string; generation: number; createdAt: Date }> = {
  kemi: { name: 'Kemi', generation: 0, createdAt: ago(60) },
  ada: { name: 'Ada', generation: 0, createdAt: ago(45) },
  femi: { name: 'Femi', generation: 0, createdAt: ago(40) },
  bayo: { name: 'Bayo', generation: 0, createdAt: ago(30) },
  musa: { name: 'Musa', generation: 0, createdAt: ago(28) },
  tobi: { name: 'Tobi', generation: 0, createdAt: ago(55) },
  ngozi: { name: 'Ngozi', generation: 0, createdAt: ago(50) },
  mira: { name: 'Mira', generation: 0, createdAt: ago(48) },
  diego: { name: 'Diego', generation: 0, createdAt: ago(35) },
  amara: { name: 'Amara', generation: 0, createdAt: ago(52) },
  kunle: { name: 'Kunle', generation: 0, createdAt: ago(44) },
  lena: { name: 'Lena', generation: 0, createdAt: ago(58) },
  mateo: { name: 'Mateo', generation: 0, createdAt: ago(41) },
  yuki: { name: 'Yuki', generation: 0, createdAt: ago(47) },
  sofia: { name: 'Sofia', generation: 0, createdAt: ago(36) },
  priya: { name: 'Priya', generation: 0, createdAt: ago(33) },
  noah: { name: 'Noah', generation: 0, createdAt: ago(27) },
  lucia: { name: 'Lucía', generation: 0, createdAt: ago(31) },
  tunde: { name: 'Tunde', generation: 1, createdAt: ago(8) },
  chioma: { name: 'Chioma', generation: 1, createdAt: minutesAgo(3) },
  zara: { name: 'Zara', generation: 1, createdAt: ago(8) },
  bisi: { name: 'Bisi', generation: 1, createdAt: ago(7) },
  leo: { name: 'Leo', generation: 1, createdAt: ago(6) },
  ife: { name: 'Ife', generation: 1, createdAt: ago(10) },
  dayo: { name: 'Dayo', generation: 2, createdAt: ago(5) },
}
const uid = (key: UserKey) => deterministicUuid(`user:${key}`)
const contactFor = (key: UserKey) => `${key}@example.com`

type ActivityKey =
  | 'kayakSat' | 'speakeasy' | 'hike' | 'kayakSun' | 'pottery' | 'salsa' | 'moonlight' | 'streetFood' | 'boardGame'
  | 'suya' | 'jollof' | 'volleyball' | 'afrobeats' | 'quiz' | 'film' | 'adire' | 'brunch' | 'lagoon' | 'idanre' | 'erin'

type City = { tz: string; currency: string }
const lisbon: City = { tz: 'Europe/Lisbon', currency: 'EUR' }
const london: City = { tz: 'Europe/London', currency: 'GBP' }
const capeTown: City = { tz: 'Africa/Johannesburg', currency: 'ZAR' }
const berlin: City = { tz: 'Europe/Berlin', currency: 'EUR' }
const mexicoCity: City = { tz: 'America/Mexico_City', currency: 'MXN' }
const lagos: City = { tz: 'Africa/Lagos', currency: 'NGN' }
const newYork: City = { tz: 'America/New_York', currency: 'USD' }
const saoPaulo: City = { tz: 'America/Sao_Paulo', currency: 'BRL' }
const tokyo: City = { tz: 'Asia/Tokyo', currency: 'JPY' }
const barcelona: City = { tz: 'Europe/Madrid', currency: 'EUR' }
const zurich: City = { tz: 'Europe/Zurich', currency: 'CHF' }

const activities: Record<ActivityKey, {
  title: string; host: UserKey; category: Category; illustration: Illustration; description: string
  location: string; city: City; startsAt: Date; priceMinor: number; capacity: number; holdout?: boolean; createdAt: Date
}> = {
  kayakSat: {
    title: 'Sunset Kayaking', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'Two hours on the Tagus as the sun drops behind the bridge. Boats, paddles and a guide included. No experience needed, just bring something you don\'t mind getting splashed.',
    location: 'Belém jetty, by the tower', city: lisbon, startsAt: localAt(anchor, '17:30', lisbon.tz), priceMinor: 4500, capacity: 12, createdAt: ago(14),
  },
  speakeasy: {
    title: 'Secret Speakeasy Tour', host: 'tobi', category: 'nights_out', illustration: 'speakeasy',
    description: 'Three hidden bars in Soho, one password each. First drink at every stop is on the house.',
    location: 'Under the clock, Soho', city: london, startsAt: localAt(shift(anchor, -1), '21:00', london.tz), priceMinor: 3500, capacity: 10, createdAt: ago(12),
  },
  hike: {
    title: 'Sunrise Hike', host: 'ngozi', category: 'outdoors', illustration: 'hike', holdout: true,
    description: 'An easy loop up Lion\'s Head timed so we reach the top as the sun comes up over the city. Coffee from a flask at the summit.',
    location: 'Lion\'s Head trailhead, Signal Hill Road', city: capeTown, startsAt: localAt(shift(anchor, 1), '05:30', capeTown.tz), priceMinor: 25000, capacity: 15, createdAt: ago(11),
  },
  kayakSun: {
    title: 'Sunset Kayaking', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'Sunday\'s run of the sunset paddle: the same stretch of the Tagus, a smaller group and a slower pace. Boats, paddles and a guide included. No experience needed.',
    location: 'Belém jetty, by the tower', city: lisbon, startsAt: localAt(shift(anchor, 1), '17:30', lisbon.tz), priceMinor: 4500, capacity: 12, createdAt: ago(14),
  },
  pottery: {
    title: 'Pottery Night', host: 'mira', category: 'classes', illustration: 'pottery',
    description: 'Throw your first bowl on the wheel in a Kreuzberg studio. Clay, aprons and firing included. Pick it up glazed two weeks later.',
    location: 'Studio 4, Kreuzberg', city: berlin, startsAt: localAt(shift(anchor, 4), '19:00', berlin.tz), priceMinor: 4000, capacity: 8, createdAt: ago(13),
  },
  salsa: {
    title: 'Rooftop Salsa', host: 'diego', category: 'nights_out', illustration: 'salsa',
    description: 'A beginner class under the lights, then open dancing until late. Come alone or bring a partner. The band starts at ten.',
    location: 'The Roof, Roma Norte', city: mexicoCity, startsAt: localAt(shift(anchor, 5), '19:30', mexicoCity.tz), priceMinor: 35000, capacity: 10, createdAt: ago(10),
  },
  moonlight: {
    title: 'Moonlight Paddle', host: 'kemi', category: 'outdoors', illustration: 'kayak',
    description: 'The same calm water as the sunset trip, but after dark with headlamps, a full moon and the city lights along the bank.',
    location: 'Belém jetty, by the tower', city: lisbon, startsAt: localAt(shift(anchor, 6), '20:00', lisbon.tz), priceMinor: 5000, capacity: 12, createdAt: ago(9),
  },
  streetFood: {
    title: 'Street Food Walk', host: 'femi', category: 'food_and_drink', illustration: 'market',
    description: 'Six stops through Balogun market, from suya to puff-puff, with the stories of who makes what. Come hungry, leave full.',
    location: 'Balogun market gate, Lagos Island', city: lagos, startsAt: localAt(shift(anchor, 7), '11:00', lagos.tz), priceMinor: 2000000, capacity: 12, createdAt: ago(9),
  },
  boardGame: {
    title: 'Board Game Night', host: 'tobi', category: 'other', illustration: 'other',
    description: 'A shelf of games and people who know the rules. Snacks included.',
    location: 'Draughts, Hackney', city: london, startsAt: localAt(thursdayBefore(14), '19:00', london.tz), priceMinor: 1200, capacity: 8, createdAt: ago(25),
  },
  suya: {
    title: 'Suya and Palm Wine Night', host: 'amara', category: 'food_and_drink', illustration: 'market',
    description: 'Mallam Sani\'s grill, a crate of fresh palm wine and a long table on the pavement. We order everything for the table, beef, chicken and kidney, with the pepper on the side for the brave. Come hungry.',
    location: 'Glover Court suya spot, Ikoyi', city: lagos, startsAt: localAt(inDays(6), '19:30', lagos.tz), priceMinor: 1500000, capacity: 10, createdAt: ago(6),
  },
  jollof: {
    title: 'Jollof Masterclass', host: 'amara', category: 'classes', illustration: 'pottery',
    description: 'Three hours in Amara\'s kitchen learning the party jollof: the base, the smoke, the bit where you leave it alone. You cook, we eat together at the end, and you leave with the recipe and a container for later.',
    location: 'Amara\'s kitchen, Lekki Phase 1', city: lagos, startsAt: localAt(shift(anchor, 10), '11:00', lagos.tz), priceMinor: 4000000, capacity: 8, createdAt: ago(8),
  },
  volleyball: {
    title: 'Beach Volleyball Sunday', host: 'ngozi', category: 'outdoors', illustration: 'hike',
    description: 'Two nets on the quieter end of Camps Bay, mixed teams, no one keeping score too seriously. We play until the light goes, then chips on the wall.',
    location: 'Camps Bay beach, by the tidal pool', city: capeTown, startsAt: localAt(inDays(2), '16:00', capeTown.tz), priceMinor: 15000, capacity: 12, createdAt: ago(7),
  },
  afrobeats: {
    title: 'Afrobeats Listening Session', host: 'kunle', category: 'nights_out', illustration: 'salsa',
    description: 'One album, start to finish, on a proper sound system, with Kunle telling the stories between tracks. This week it\'s a 1977 pressing nobody has heard in full for years. Drinks at the bar, dancing optional but likely.',
    location: 'Public Records, Gowanus, Brooklyn', city: newYork, startsAt: localAt(inDays(1), '20:00', newYork.tz), priceMinor: 2000, capacity: 16, createdAt: ago(5),
  },
  quiz: {
    title: 'Pub Quiz Night', host: 'tobi', category: 'other', illustration: 'other',
    description: 'Six rounds, teams of up to four, a picture round that is mostly nineties television. The winning table drinks free next week. You can book alone and we will put you on a team.',
    location: 'The Cave, Islington', city: london, startsAt: localAt(inDays(5), '19:00', london.tz), priceMinor: 800, capacity: 20, createdAt: ago(9),
  },
  film: {
    title: 'Open-Air Film Night', host: 'sofia', category: 'other', illustration: 'other',
    description: 'A classic on the big screen under the trees in Ibirapuera, with deck chairs, blankets and a popcorn stand. The film is announced a week before. Gates open an hour early so you can settle in while it\'s still light.',
    location: 'Parque Ibirapuera, Portão 3', city: saoPaulo, startsAt: localAt(shift(anchor, 2), '19:30', saoPaulo.tz), priceMinor: 4000, capacity: 20, createdAt: ago(4),
  },
  adire: {
    title: 'Shibori Indigo Workshop', host: 'yuki', category: 'classes', illustration: 'pottery',
    description: 'Learn three shibori folds, then dye two metres of cotton in a real indigo vat and take it home. Aprons and gloves provided. Wear something you don\'t mind turning blue.',
    location: 'Yuki\'s studio, Nakameguro, Tokyo', city: tokyo, startsAt: localAt(shift(anchor, 3), '10:00', tokyo.tz), priceMinor: 650000, capacity: 10, createdAt: ago(6),
  },
  brunch: {
    title: 'Sunday Brunch Club', host: 'mateo', category: 'food_and_drink', illustration: 'market',
    description: 'A long table in Gràcia, a set menu that changes every time, and no rush. This one is tortilla, pan con tomate and the good coffee, then churros. Good for meeting people; most tables end up talking to each other.',
    location: 'Carrer de Verdi, Gràcia, Barcelona', city: barcelona, startsAt: localAt(shift(anchor, 8), '11:00', barcelona.tz), priceMinor: 3200, capacity: 10, createdAt: ago(3),
  },
  lagoon: {
    title: 'Lake Zurich Boat Picnic', host: 'lena', category: 'outdoors', illustration: 'kayak',
    description: 'A slow afternoon on the lake in a covered boat, with a cooler, a speaker and a swim stop if the water is warm enough. Food and drinks included. Fourteen spots and the boat leaves on time.',
    location: 'Zürichhorn jetty', city: zurich, startsAt: localAt(shift(anchor, 14), '12:00', zurich.tz), priceMinor: 9000, capacity: 14, createdAt: ago(2),
  },
  idanre: {
    title: 'Rigi Ridge Day Hike', host: 'lena', category: 'outdoors', illustration: 'hike',
    description: 'Train and boat from Zürich at dawn, then the ridge path along the Rigi with the lakes on both sides and lunch at a mountain hut. Back in the city by seven. Bring real shoes and two litres of water.',
    location: 'Meet at Zürich HB, under the clock', city: zurich, startsAt: localAt(inDays(1), '06:30', zurich.tz), priceMinor: 6000, capacity: 16, createdAt: ago(10),
  },
  erin: {
    title: 'Lauterbrunnen Waterfall Trek', host: 'lena', category: 'outdoors', illustration: 'hike',
    description: 'Seventy-two waterfalls in one valley and a path that climbs past half of them. Most people stop at the viewpoint above Staubbach; the keen ones carry on to Wengen. Train, a guide and a packed lunch included. Not one for flip-flops.',
    location: 'Meet at Zürich HB, under the clock', city: zurich, startsAt: localAt(shift(anchor, 15), '06:30', zurich.tz), priceMinor: 7500, capacity: 14, createdAt: ago(3),
  },
}
const aid = (key: ActivityKey) =>
  deterministicUuidWhere(`activity:${key}`, (id) => isHoldout(id) === Boolean(activities[key].holdout))

type Member = { user: UserKey; via: 'direct' | { invite: string }; at: Date }
type PlanSeed = { key: string; activity: ActivityKey; owner: UserKey; members: Member[] }

type InviteSeed = {
  code: string; rail: Rail; inviter: UserKey; activity: ActivityKey; plan: string | null
  recipient?: string; label?: string; createdAt: Date
  opens?: { at: Date; spotsLeft: number; anonId?: string; platform?: Platform }[]
}

const invites: InviteSeed[] = [
  // Ada's invites on Sunset Kayaking, as on the My invites screen.
  { code: 'BQ7N4XKD', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: contactFor('tunde'), label: 'Tunde', createdAt: ago(9), opens: [{ at: ago(8, 1), spotsLeft: 7, platform: 'mobile' }] },
  { code: 'CH3M9WRT', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: contactFor('chioma'), label: 'Chioma', createdAt: ago(3), opens: [{ at: minutesAgo(20), spotsLeft: 2, platform: 'mobile' }] },
  { code: 'AX7K29QM', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: 'dami@example.com', label: 'Dami', createdAt: ago(2), opens: [{ at: ago(1), spotsLeft: 2, platform: 'mobile' }] },
  { code: 'BG5K2YNP', rail: 'vouch', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', recipient: '+1 415 555 0133', label: 'Bola', createdAt: ago(1) },
  { code: 'M2QW7HTA', rail: 'public', inviter: 'ada', activity: 'kayakSat', plan: 'ada-kayak', label: 'Group chat link', createdAt: ago(8),
    opens: [1, 2, 3, 4, 5, 6].map((n) => ({ at: ago(8 - n * 0.9), spotsLeft: 8 - n, anonId: `anon-groupchat-${n}`, platform: (n % 2 ? 'mobile' : 'web') as Platform })) },
  { code: 'SY8H4QMD', rail: 'vouch', inviter: 'ada', activity: 'pottery', plan: 'ada-pottery', recipient: 'seyi@example.com', label: 'Seyi', createdAt: ago(7), opens: [{ at: ago(4), spotsLeft: 0, platform: 'mobile' }] },
  { code: 'QR4T82NP', rail: 'vouch', inviter: 'ada', activity: 'boardGame', plan: 'ada-boardgame', recipient: 'kola@example.com', label: 'Kola', createdAt: ago(21) },
  // Everyone else on Sunset Kayaking.
  { code: 'ZR6P3KWX', rail: 'vouch', inviter: 'femi', activity: 'kayakSat', plan: 'femi-kayak', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(9), opens: [{ at: ago(8, 2), spotsLeft: 9, platform: 'mobile' }] },
  { code: 'FM2K7HDQ', rail: 'public', inviter: 'femi', activity: 'kayakSat', plan: 'femi-kayak', createdAt: ago(9),
    opens: [{ at: ago(7, 1), spotsLeft: 8, anonId: 'anon-bisi', platform: 'mobile' }, { at: ago(6, 1), spotsLeft: 7, anonId: 'anon-leo', platform: 'web' }, { at: ago(5), spotsLeft: 5, anonId: 'anon-femi-link-3', platform: 'mobile' }] },
  { code: 'KM4V8TXE', rail: 'vouch', inviter: 'kemi', activity: 'kayakSat', plan: null, recipient: contactFor('ife'), label: 'Ife', createdAt: ago(11), opens: [{ at: ago(10, 1), spotsLeft: 12, platform: 'mobile' }] },
  { code: 'H7PD3KXA', rail: 'public', inviter: 'kemi', activity: 'kayakSat', plan: null, createdAt: ago(12),
    opens: [{ at: ago(11), spotsLeft: 12, anonId: 'anon-host-1', platform: 'web' }, { at: ago(3), spotsLeft: 3, anonId: 'anon-host-2', platform: 'mobile' }] },
  { code: 'DY9Q3NPX', rail: 'public', inviter: 'ife', activity: 'kayakSat', plan: 'ife-kayak', createdAt: ago(10), opens: [{ at: ago(5, 1), spotsLeft: 6, anonId: 'anon-dayo', platform: 'mobile' }] },
  // Other activities.
  { code: 'TB3N7QWK', rail: 'vouch', inviter: 'tobi', activity: 'kayakSun', plan: 'tobi-kayaksun', recipient: contactFor('ngozi'), label: 'Ngozi', createdAt: ago(5), opens: [{ at: ago(4, 1), spotsLeft: 11, platform: 'web' }] },
  { code: 'MR8K2DXP', rail: 'public', inviter: 'mira', activity: 'kayakSun', plan: 'mira-kayaksun', createdAt: ago(4), opens: [{ at: ago(3, 1), spotsLeft: 9, anonId: 'anon-bayo', platform: 'mobile' }, { at: ago(2, 1), spotsLeft: 8, anonId: 'anon-musa', platform: 'mobile' }] },
  { code: 'FZ4M9HTQ', rail: 'vouch', inviter: 'femi', activity: 'moonlight', plan: 'femi-moonlight', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 11, platform: 'mobile' }] },
  { code: 'SP7Q3WKD', rail: 'public', inviter: 'mira', activity: 'speakeasy', plan: 'mira-speakeasy', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 6, anonId: 'anon-leo-2', platform: 'web' }] },
  { code: 'ZS3N8QHT', rail: 'vouch', inviter: 'femi', activity: 'streetFood', plan: 'femi-streetfood', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(8), opens: [{ at: ago(7, 1), spotsLeft: 11, platform: 'mobile' }] },
  { code: 'SF7W2MDK', rail: 'public', inviter: 'femi', activity: 'streetFood', plan: 'femi-streetfood', createdAt: ago(8), opens: [{ at: ago(6, 1), spotsLeft: 10, anonId: 'anon-ada', platform: 'web' }] },
  // This weekend and the week after.
  { code: 'SU8Y3QKD', rail: 'public', inviter: 'ada', activity: 'suya', plan: 'ada-suya', createdAt: ago(5), opens: [{ at: ago(4, 2), spotsLeft: 8, anonId: 'anon-tunde-suya', platform: 'mobile' }, { at: ago(1), spotsLeft: 3, anonId: 'anon-suya-late', platform: 'web' }] },
  { code: 'BY7N2MXW', rail: 'vouch', inviter: 'bayo', activity: 'suya', plan: 'bayo-suya', recipient: contactFor('leo'), label: 'Leo', createdAt: ago(4), opens: [{ at: ago(3, 2), spotsLeft: 6, platform: 'mobile' }] },
  { code: 'ZR3K8PDQ', rail: 'public', inviter: 'zara', activity: 'suya', plan: 'zara-suya', createdAt: ago(3), opens: [{ at: ago(2, 1), spotsLeft: 4, anonId: 'anon-bisi-suya', platform: 'mobile' }] },
  { code: 'NJ3M7KXQ', rail: 'vouch', inviter: 'ngozi', activity: 'jollof', plan: 'ngozi-jollof', recipient: contactFor('musa'), label: 'Musa', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 7, platform: 'web' }] },
  { code: 'KJ9P2WTX', rail: 'public', inviter: 'kemi', activity: 'jollof', plan: 'kemi-jollof', createdAt: ago(5), opens: [{ at: ago(4), spotsLeft: 5, anonId: 'anon-dayo-jollof', platform: 'mobile' }] },
  { code: 'TM5K9WQX', rail: 'vouch', inviter: 'tobi', activity: 'volleyball', plan: 'tobi-volley', recipient: contactFor('mira'), label: 'Mira', createdAt: ago(5), opens: [{ at: ago(4, 3), spotsLeft: 10, platform: 'mobile' }] },
  { code: 'FV2Q7NXK', rail: 'public', inviter: 'femi', activity: 'volleyball', plan: 'femi-volley', createdAt: ago(4), opens: [{ at: ago(3), spotsLeft: 9, anonId: 'anon-zara-volley', platform: 'mobile' }] },
  { code: 'TA6K4QMW', rail: 'public', inviter: 'tobi', activity: 'afrobeats', plan: 'tobi-afro', createdAt: ago(4), opens: [{ at: ago(3, 1), spotsLeft: 14, anonId: 'anon-leo-afro', platform: 'web' }] },
  { code: 'EF8W3NXK', rail: 'vouch', inviter: 'ife', activity: 'afrobeats', plan: 'ife-afro', recipient: contactFor('tunde'), label: 'Tunde', createdAt: ago(3), opens: [{ at: ago(2, 2), spotsLeft: 12, platform: 'mobile' }] },
  { code: 'FQ4N8KXP', rail: 'public', inviter: 'femi', activity: 'quiz', plan: 'femi-quiz', createdAt: ago(7), opens: [{ at: ago(6), spotsLeft: 18, anonId: 'anon-zara-quiz', platform: 'mobile' }, { at: ago(5, 2), spotsLeft: 17, anonId: 'anon-bisi-quiz', platform: 'web' }] },
  { code: 'MQ7K2WDX', rail: 'vouch', inviter: 'mira', activity: 'quiz', plan: 'mira-quiz', recipient: contactFor('diego'), label: 'Diego', createdAt: ago(6), opens: [{ at: ago(5, 1), spotsLeft: 16, platform: 'mobile' }] },
  { code: 'AQ5P9NXK', rail: 'vouch', inviter: 'ada', activity: 'quiz', plan: 'ada-quiz', recipient: contactFor('chioma'), label: 'Chioma', createdAt: ago(4), opens: [{ at: ago(3, 2), spotsLeft: 14, platform: 'mobile' }] },
  { code: 'TF3Q8KWX', rail: 'public', inviter: 'tunde', activity: 'film', plan: 'tunde-film', createdAt: ago(3), opens: [{ at: ago(2, 3), spotsLeft: 18, anonId: 'anon-chioma-film', platform: 'mobile' }, { at: ago(2), spotsLeft: 17, anonId: 'anon-zara-film', platform: 'web' }] },
  { code: 'BF9N2PXQ', rail: 'vouch', inviter: 'bisi', activity: 'film', plan: 'bisi-film', recipient: contactFor('leo'), label: 'Leo', createdAt: ago(3), opens: [{ at: ago(2, 1), spotsLeft: 16, platform: 'mobile' }] },
  { code: 'NA2K7QXW', rail: 'vouch', inviter: 'ngozi', activity: 'adire', plan: 'ngozi-adire', recipient: contactFor('mira'), label: 'Mira', createdAt: ago(5), opens: [{ at: ago(4, 1), spotsLeft: 9, platform: 'web' }] },
  { code: 'AB4K8WXQ', rail: 'vouch', inviter: 'ada', activity: 'brunch', plan: 'ada-brunch', recipient: contactFor('tunde'), label: 'Tunde', createdAt: ago(2), opens: [{ at: ago(1, 4), spotsLeft: 9, platform: 'mobile' }] },
  { code: 'FG6Q3NKX', rail: 'vouch', inviter: 'femi', activity: 'lagoon', plan: 'femi-lagoon', recipient: contactFor('bisi'), label: 'Bisi', createdAt: ago(1), opens: [{ at: ago(0, 6), spotsLeft: 13, platform: 'mobile' }] },
  { code: 'KD7Q3NXW', rail: 'vouch', inviter: 'kemi', activity: 'idanre', plan: 'kemi-idanre', recipient: contactFor('ada'), label: 'Ada', createdAt: ago(8), opens: [{ at: ago(7, 2), spotsLeft: 14, platform: 'mobile' }] },
  { code: 'TD4K8QXP', rail: 'public', inviter: 'tobi', activity: 'idanre', plan: 'tobi-idanre', createdAt: ago(7), opens: [{ at: ago(6, 1), spotsLeft: 13, anonId: 'anon-mira-idanre', platform: 'web' }, { at: ago(5), spotsLeft: 12, anonId: 'anon-diego-idanre', platform: 'mobile' }] },
  { code: 'FE9N3KQX', rail: 'vouch', inviter: 'femi', activity: 'erin', plan: 'femi-erin', recipient: contactFor('zara'), label: 'Zara', createdAt: ago(2), opens: [{ at: ago(1, 5), spotsLeft: 13, platform: 'mobile' }] },
]

const plans: PlanSeed[] = [
  { key: 'ada-kayak', activity: 'kayakSat', owner: 'ada', members: [
    { user: 'ada', via: 'direct', at: ago(10) },
    { user: 'tunde', via: { invite: 'BQ7N4XKD' }, at: ago(8) },
    { user: 'chioma', via: { invite: 'CH3M9WRT' }, at: minutesAgo(3) },
  ] },
  { key: 'femi-kayak', activity: 'kayakSat', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(9, 2) },
    { user: 'zara', via: { invite: 'ZR6P3KWX' }, at: ago(8, 1) },
    { user: 'bisi', via: { invite: 'FM2K7HDQ' }, at: ago(7) },
    { user: 'leo', via: { invite: 'FM2K7HDQ' }, at: ago(6) },
  ] },
  { key: 'ife-kayak', activity: 'kayakSat', owner: 'ife', members: [
    { user: 'ife', via: { invite: 'KM4V8TXE' }, at: ago(10) },
    { user: 'dayo', via: { invite: 'DY9Q3NPX' }, at: ago(5) },
  ] },
  { key: 'bayo-kayak', activity: 'kayakSat', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(6, 3) }] },

  { key: 'tobi-kayaksun', activity: 'kayakSun', owner: 'tobi', members: [
    { user: 'tobi', via: 'direct', at: ago(5, 1) },
    { user: 'ngozi', via: { invite: 'TB3N7QWK' }, at: ago(4) },
  ] },
  { key: 'mira-kayaksun', activity: 'kayakSun', owner: 'mira', members: [
    { user: 'mira', via: 'direct', at: ago(4, 1) },
    { user: 'bayo', via: { invite: 'MR8K2DXP' }, at: ago(3) },
    { user: 'musa', via: { invite: 'MR8K2DXP' }, at: ago(2) },
  ] },
  { key: 'diego-kayaksun', activity: 'kayakSun', owner: 'diego', members: [{ user: 'diego', via: 'direct', at: ago(3, 2) }] },

  { key: 'femi-moonlight', activity: 'moonlight', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(6, 1) },
    { user: 'zara', via: { invite: 'FZ4M9HTQ' }, at: ago(5) },
  ] },

  { key: 'ngozi-speakeasy', activity: 'speakeasy', owner: 'ngozi', members: [{ user: 'ngozi', via: 'direct', at: ago(7) }] },
  { key: 'mira-speakeasy', activity: 'speakeasy', owner: 'mira', members: [
    { user: 'mira', via: 'direct', at: ago(6, 1) },
    { user: 'leo', via: { invite: 'SP7Q3WKD' }, at: ago(5) },
  ] },
  { key: 'bayo-speakeasy', activity: 'speakeasy', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(5, 2) }] },
  { key: 'musa-speakeasy', activity: 'speakeasy', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(4, 1) }] },
  { key: 'dayo-speakeasy', activity: 'speakeasy', owner: 'dayo', members: [{ user: 'dayo', via: 'direct', at: ago(3, 1) }] },

  ...(['tobi', 'mira', 'diego', 'bayo', 'musa', 'femi'] as UserKey[]).map((user, i) => ({
    key: `${user}-hike`, activity: 'hike' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(9 - i, i) }],
  })),

  { key: 'ada-pottery', activity: 'pottery', owner: 'ada', members: [{ user: 'ada', via: 'direct', at: ago(7, 2) }] },
  ...(['tunde', 'femi', 'zara', 'bisi', 'leo', 'ife', 'dayo'] as UserKey[]).map((user, i) => ({
    key: `${user}-pottery`, activity: 'pottery' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(7 - i * 0.4, 1) }],
  })),

  ...(['kemi', 'tobi', 'ngozi', 'mira', 'tunde', 'chioma', 'femi', 'zara', 'bisi', 'leo'] as UserKey[]).map((user, i) => ({
    key: `${user}-salsa`, activity: 'salsa' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(8 - i * 0.5, 2) }],
  })),

  { key: 'femi-streetfood', activity: 'streetFood', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(8, 1) },
    { user: 'zara', via: { invite: 'ZS3N8QHT' }, at: ago(7) },
    { user: 'ada', via: { invite: 'SF7W2MDK' }, at: ago(6) },
  ] },
  { key: 'bayo-streetfood', activity: 'streetFood', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(5, 1) }] },
  { key: 'musa-streetfood', activity: 'streetFood', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(3, 2) }] },

  { key: 'ada-boardgame', activity: 'boardGame', owner: 'ada', members: [{ user: 'ada', via: 'direct', at: ago(22) }] },
  ...(['femi', 'bayo', 'musa'] as UserKey[]).map((user, i) => ({
    key: `${user}-boardgame`, activity: 'boardGame' as ActivityKey, owner: user, members: [{ user, via: 'direct' as const, at: ago(20 - i) }],
  })),

  // Suya night: 8 of 10, two left, the scarcity state on Explore.
  { key: 'ada-suya', activity: 'suya', owner: 'ada', members: [
    { user: 'ada', via: 'direct', at: ago(5, 3) },
    { user: 'tunde', via: { invite: 'SU8Y3QKD' }, at: ago(4, 1) },
  ] },
  { key: 'musa-suya', activity: 'suya', owner: 'musa', members: [{ user: 'musa', via: 'direct', at: ago(5) }] },
  { key: 'bayo-suya', activity: 'suya', owner: 'bayo', members: [
    { user: 'bayo', via: 'direct', at: ago(4, 4) },
    { user: 'leo', via: { invite: 'BY7N2MXW' }, at: ago(3, 1) },
  ] },
  { key: 'zara-suya', activity: 'suya', owner: 'zara', members: [
    { user: 'zara', via: 'direct', at: ago(3, 3) },
    { user: 'bisi', via: { invite: 'ZR3K8PDQ' }, at: ago(2) },
  ] },
  { key: 'dayo-suya', activity: 'suya', owner: 'dayo', members: [{ user: 'dayo', via: 'direct', at: ago(1, 2) }] },

  { key: 'ngozi-jollof', activity: 'jollof', owner: 'ngozi', members: [
    { user: 'ngozi', via: 'direct', at: ago(7) },
    { user: 'musa', via: { invite: 'NJ3M7KXQ' }, at: ago(5) },
  ] },
  { key: 'bisi-jollof', activity: 'jollof', owner: 'bisi', members: [{ user: 'bisi', via: 'direct', at: ago(6, 2) }] },
  { key: 'kemi-jollof', activity: 'jollof', owner: 'kemi', members: [
    { user: 'kemi', via: 'direct', at: ago(5, 5) },
    { user: 'dayo', via: { invite: 'KJ9P2WTX' }, at: ago(3, 6) },
  ] },

  { key: 'tobi-volley', activity: 'volleyball', owner: 'tobi', members: [
    { user: 'tobi', via: 'direct', at: ago(6) },
    { user: 'mira', via: { invite: 'TM5K9WQX' }, at: ago(4, 2) },
  ] },
  { key: 'priya-volley', activity: 'volleyball', owner: 'priya', members: [{ user: 'priya', via: 'direct', at: ago(5, 1) }] },
  { key: 'femi-volley', activity: 'volleyball', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(4, 6) },
    { user: 'zara', via: { invite: 'FV2Q7NXK' }, at: ago(2, 5) },
  ] },

  { key: 'tobi-afro', activity: 'afrobeats', owner: 'tobi', members: [
    { user: 'tobi', via: 'direct', at: ago(4, 5) },
    { user: 'leo', via: { invite: 'TA6K4QMW' }, at: ago(3) },
  ] },
  { key: 'chioma-afro', activity: 'afrobeats', owner: 'chioma', members: [{ user: 'chioma', via: 'direct', at: ago(4) }] },
  { key: 'ife-afro', activity: 'afrobeats', owner: 'ife', members: [
    { user: 'ife', via: 'direct', at: ago(3, 4) },
    { user: 'tunde', via: { invite: 'EF8W3NXK' }, at: ago(2, 1) },
  ] },
  { key: 'noah-afro', activity: 'afrobeats', owner: 'noah', members: [{ user: 'noah', via: 'direct', at: ago(1, 3) }] },

  { key: 'femi-quiz', activity: 'quiz', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(8) },
    { user: 'zara', via: { invite: 'FQ4N8KXP' }, at: ago(5, 22) },
    { user: 'bisi', via: { invite: 'FQ4N8KXP' }, at: ago(5, 1) },
  ] },
  { key: 'mira-quiz', activity: 'quiz', owner: 'mira', members: [
    { user: 'mira', via: 'direct', at: ago(6, 4) },
    { user: 'diego', via: { invite: 'MQ7K2WDX' }, at: ago(5) },
  ] },
  { key: 'ada-quiz', activity: 'quiz', owner: 'ada', members: [
    { user: 'ada', via: 'direct', at: ago(4, 6) },
    { user: 'chioma', via: { invite: 'AQ5P9NXK' }, at: ago(3, 1) },
  ] },
  { key: 'bayo-quiz', activity: 'quiz', owner: 'bayo', members: [{ user: 'bayo', via: 'direct', at: ago(3) }] },
  { key: 'noah-quiz', activity: 'quiz', owner: 'noah', members: [{ user: 'noah', via: 'direct', at: ago(2, 2) }] },

  { key: 'tunde-film', activity: 'film', owner: 'tunde', members: [
    { user: 'tunde', via: 'direct', at: ago(3, 5) },
    { user: 'chioma', via: { invite: 'TF3Q8KWX' }, at: ago(2, 2) },
    { user: 'zara', via: { invite: 'TF3Q8KWX' }, at: ago(1, 20) },
  ] },
  { key: 'bisi-film', activity: 'film', owner: 'bisi', members: [
    { user: 'bisi', via: 'direct', at: ago(3, 2) },
    { user: 'leo', via: { invite: 'BF9N2PXQ' }, at: ago(2) },
  ] },
  { key: 'lucia-film', activity: 'film', owner: 'lucia', members: [{ user: 'lucia', via: 'direct', at: ago(2, 6) }] },
  { key: 'mira-film', activity: 'film', owner: 'mira', members: [{ user: 'mira', via: 'direct', at: ago(1) }] },

  { key: 'ngozi-adire', activity: 'adire', owner: 'ngozi', members: [
    { user: 'ngozi', via: 'direct', at: ago(5, 6) },
    { user: 'mira', via: { invite: 'NA2K7QXW' }, at: ago(4) },
  ] },
  { key: 'ife-adire', activity: 'adire', owner: 'ife', members: [{ user: 'ife', via: 'direct', at: ago(3, 3) }] },
  { key: 'priya-adire', activity: 'adire', owner: 'priya', members: [{ user: 'priya', via: 'direct', at: ago(2, 1) }] },

  { key: 'ada-brunch', activity: 'brunch', owner: 'ada', members: [
    { user: 'ada', via: 'direct', at: ago(2, 5) },
    { user: 'tunde', via: { invite: 'AB4K8WXQ' }, at: ago(1, 3) },
  ] },
  { key: 'lucia-brunch', activity: 'brunch', owner: 'lucia', members: [{ user: 'lucia', via: 'direct', at: ago(1) }] },

  { key: 'femi-lagoon', activity: 'lagoon', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(1, 6) },
    { user: 'bisi', via: { invite: 'FG6Q3NKX' }, at: ago(0, 5) },
  ] },

  { key: 'kemi-idanre', activity: 'idanre', owner: 'kemi', members: [
    { user: 'kemi', via: 'direct', at: ago(9) },
    { user: 'ada', via: { invite: 'KD7Q3NXW' }, at: ago(7, 1) },
  ] },
  { key: 'tobi-idanre', activity: 'idanre', owner: 'tobi', members: [
    { user: 'tobi', via: 'direct', at: ago(8, 3) },
    { user: 'mira', via: { invite: 'TD4K8QXP' }, at: ago(6) },
    { user: 'diego', via: { invite: 'TD4K8QXP' }, at: ago(4, 6) },
  ] },
  { key: 'priya-idanre', activity: 'idanre', owner: 'priya', members: [{ user: 'priya', via: 'direct', at: ago(5, 2) }] },

  { key: 'femi-erin', activity: 'erin', owner: 'femi', members: [
    { user: 'femi', via: 'direct', at: ago(2, 4) },
    { user: 'zara', via: { invite: 'FE9N3KQX' }, at: ago(1, 4) },
  ] },
  { key: 'yuki-erin', activity: 'erin', owner: 'yuki', members: [{ user: 'yuki', via: 'direct', at: ago(0, 9) }] },
]

const planId = (key: string) => deterministicUuid(`plan:${key}`)
const inviteId = (code: string) => deterministicUuid(`invite:${code}`)
const bookingId = (plan: string, user: UserKey) => deterministicUuid(`booking:${plan}:${user}`)
const inviteByCode = new Map(invites.map((i) => [i.code, i]))

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE users, activities, activity_photos, plans, bookings, invites, invite_revocations,
      attributions, events, flag_exposures, spot_watches, feature_flags RESTART IDENTITY CASCADE`)
  await prisma.featureFlag.create({ data: { key: 'invites', enabled: true, rolloutPercent: 100 } })

  await prisma.user.createMany({
    data: (Object.keys(users) as UserKey[]).map((key) => ({
      id: uid(key),
      displayName: users[key].name,
      generation: users[key].generation,
      contactHmac: hmacContact(normalizeContact(contactFor(key))!),
      createdAt: users[key].createdAt,
    })),
  })

  const spotsTaken: Record<ActivityKey, number> = Object.fromEntries((Object.keys(activities) as ActivityKey[]).map((k) => [k, 0])) as Record<ActivityKey, number>
  for (const plan of plans) spotsTaken[plan.activity] += plan.members.length

  await prisma.activity.createMany({
    data: (Object.keys(activities) as ActivityKey[]).map((key) => {
      const a = activities[key]
      return {
        id: aid(key), hostId: uid(a.host), title: a.title, description: a.description, category: a.category,
        illustration: a.illustration, location: a.location, startsAt: a.startsAt, timezone: a.city.tz, priceMinor: a.priceMinor,
        currency: a.city.currency, capacity: a.capacity, spotsTaken: spotsTaken[key], version: 1 + spotsTaken[key], flagBucket: activityBucket(aid(key)), createdAt: a.createdAt,
      }
    }),
  })

  // Three photos per activity, copied from seed-photos into the uploads folder the API serves. Position 0 is the cover.
  await mkdir(config.UPLOADS_DIR, { recursive: true })
  const photos = (Object.keys(activities) as ActivityKey[]).flatMap((key) => [0, 1, 2].map((n) => ({ key, n, fileName: `seed-${key}-${n}.jpg` })))
  await Promise.all(photos.map((p) => copyFile(path.join(photosDir, `${p.key}-${p.n}.jpg`), path.join(config.UPLOADS_DIR, p.fileName))))
  await prisma.activityPhoto.createMany({
    data: photos.map((p) => ({ activityId: aid(p.key), url: `/uploads/${p.fileName}`, position: p.n, createdAt: activities[p.key].createdAt })),
  })

  await prisma.plan.createMany({
    data: plans.map((p) => ({
      id: planId(p.key), activityId: aid(p.activity), ownerId: uid(p.owner),
      createdAt: p.members.reduce((min, m) => (m.at < min ? m.at : min), p.members[0]!.at),
    })),
  })

  await prisma.invite.createMany({
    data: invites.map((i) => ({
      id: inviteId(i.code), code: i.code, rail: i.rail, inviterId: uid(i.inviter), activityId: aid(i.activity),
      planId: i.plan ? planId(i.plan) : null,
      recipientHmac: i.recipient ? hmacContact(normalizeContact(i.recipient)!) : null,
      recipientLabel: i.label ?? null, expiresAt: activities[i.activity].startsAt, createdAt: i.createdAt,
    })),
  })

  const bookings = plans.flatMap((p) =>
    p.members.map((m) => ({
      id: bookingId(p.key, m.user), activityId: aid(p.activity), planId: planId(p.key), userId: uid(m.user),
      inviteId: m.via === 'direct' ? null : inviteId(m.via.invite),
      idempotencyKey: `seed-${p.key}-${m.user}`, createdAt: m.at,
    })),
  )
  await prisma.booking.createMany({ data: bookings })

  const attributions = plans.flatMap((p) =>
    p.members.flatMap((m) => {
      if (m.via === 'direct') return []
      const invite = inviteByCode.get(m.via.invite)!
      const inviteeNew = users[m.user].generation === users[invite.inviter].generation + 1 && users[m.user].createdAt.getTime() <= m.at.getTime() + HOUR && users[m.user].generation > 0
      return [{
        inviteId: inviteId(invite.code), rail: invite.rail, code: invite.code, inviterId: uid(invite.inviter), inviteeId: uid(m.user),
        inviteeWasNew: inviteeNew, hopGeneration: users[invite.inviter].generation + 1, planId: planId(p.key),
        bookingId: bookingId(p.key, m.user), createdAt: m.at,
      }]
    }),
  )
  await prisma.attribution.createMany({ data: attributions })

  const events = [
    ...invites.map((i) => ({
      name: 'invite_created', occurredAt: i.createdAt, userId: uid(i.inviter), platform: 'web' as Platform,
      activityId: aid(i.activity), inviteId: inviteId(i.code), rail: i.rail, props: { planId: i.plan ? planId(i.plan) : null },
    })),
    ...invites.flatMap((i) =>
      (i.opens ?? []).map((o, n) => ({
        name: 'invite_opened', occurredAt: o.at, anonId: o.anonId ?? `anon-${i.code.toLowerCase()}-${n}`, platform: o.platform ?? ('mobile' as Platform),
        activityId: aid(i.activity), inviteId: inviteId(i.code), rail: i.rail, props: { spotsLeftAtOpen: o.spotsLeft },
      })),
    ),
    // Every seeded booking also gets the attempt that preceded it, and every claim the open, so the funnel views divide by the right thing.
    ...bookings.flatMap((b) => {
      const rail = b.inviteId ? inviteByCode.get(invites.find((i) => inviteId(i.code) === b.inviteId)!.code)!.rail : null
      const platform = (b.inviteId ? 'mobile' : 'web') as Platform
      const before = (minutes: number) => new Date(b.createdAt.getTime() - minutes * 60_000)
      return [
        ...(b.inviteId
          ? [{ name: 'invite_opened', occurredAt: before(12), userId: b.userId, platform, activityId: b.activityId, inviteId: b.inviteId, rail, props: { spotsLeftAtOpen: 4 } },
             { name: 'activity_viewed', occurredAt: before(11), userId: b.userId, platform, activityId: b.activityId, inviteId: null, rail: null, props: { fromInvite: true } },
             { name: 'claim_started', occurredAt: before(8), userId: b.userId, platform, activityId: b.activityId, inviteId: b.inviteId, rail, props: {} },
             { name: 'claim_submitted', occurredAt: before(2), userId: b.userId, platform, activityId: b.activityId, inviteId: b.inviteId, rail, props: {} }]
          : [{ name: 'activity_viewed', occurredAt: before(6), userId: b.userId, platform, activityId: b.activityId, inviteId: null, rail: null, props: { fromInvite: false } }]),
        { name: b.inviteId ? 'claim_attempted' : 'booking_attempted', occurredAt: before(1), userId: b.userId, platform, activityId: b.activityId, inviteId: b.inviteId, rail, props: { source: b.inviteId ? 'invite' : 'direct' } },
        { name: 'booking_succeeded', occurredAt: b.createdAt, userId: b.userId, platform, activityId: b.activityId, inviteId: b.inviteId, rail, props: { planId: b.planId, source: b.inviteId ? 'invite' : 'direct' } },
      ]
    }),
    ...attributions.map((a) => ({
      name: 'spot_claimed', occurredAt: a.createdAt, userId: a.inviteeId, platform: 'mobile' as Platform, activityId: aid(invites.find((i) => i.code === a.code)!.activity),
      inviteId: a.inviteId, rail: a.rail, props: { wasNew: a.inviteeWasNew, hopGeneration: a.hopGeneration },
    })),
    ...(Object.keys(users) as UserKey[]).filter((k) => users[k].generation > 0).map((k) => ({
      name: 'user_created', occurredAt: users[k].createdAt, userId: uid(k), platform: 'mobile' as Platform,
      props: { generation: users[k].generation },
    })),
  ]
  await prisma.event.createMany({ data: events })

  const check = await prisma.$queryRaw<{ title: string; spots_taken: number; confirmed: bigint; capacity: number }[]>`
    SELECT a.title, a.spots_taken, a.capacity, COUNT(b.id) AS confirmed
    FROM activities a LEFT JOIN bookings b ON b.activity_id = a.id AND b.status = 'confirmed'
    GROUP BY a.id ORDER BY a.starts_at`
  const drift = check.filter((r) => Number(r.confirmed) !== r.spots_taken || r.spots_taken > r.capacity)
  if (drift.length) throw new Error(`Seed drift: ${JSON.stringify(drift)}`)

  const line = (label: string, value: string) => console.log(`${label.padEnd(26)} ${value}`)
  console.log('Seeded.\n')
  line('Ada (booker)', uid('ada'))
  line('Kemi (host)', uid('kemi'))
  line('Sunset Kayaking (Sat)', `${aid('kayakSat')}  ${spotsTaken.kayakSat} of 12 booked`)
  line('Holdout activity', `${aid('hike')}  Sunrise Hike`)
  line('Full activities', 'Pottery Night, Rooftop Salsa')
  line('This weekend', 'Rigi Ridge Day Hike, Afrobeats Listening Session, Beach Volleyball Sunday')
  console.log()
  line('Vouch to claim', `${displayCode('AX7K29QM')}  Ada -> Dami, claim with dami@example.com`)
  line('Vouch not opened', `${displayCode('BG5K2YNP')}  Ada -> Bola, claim with +1 415 555 0133`)
  line('Public link (Ada)', displayCode('M2QW7HTA'))
  line('Host link (Kemi)', displayCode('H7PD3KXA'))
  line('Vouch opened when full', `${displayCode('SY8H4QMD')}  Pottery Night`)
  line('Expired vouch', `${displayCode('QR4T82NP')}  Board Game Night`)
  console.log()
  for (const r of check) line(r.title, `${r.spots_taken}/${r.capacity}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
