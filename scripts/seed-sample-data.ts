/**
 * Sample data for a local run: a small menu (drinks, food, books), a couple of
 * upcoming events, and — when an owner phone is given — an owner account.
 *
 * Idempotent: every row has a stable id or unique key and is upserted, so running
 * it again refreshes the samples (prices, dates) instead of duplicating them, and
 * leaves anything you added yourself alone. `scripts/seed.ts` is the CLI
 * (`npm run db:seed`); the integration and E2E tests call `seedSampleData` to put
 * a freshly reset test database back into the same known state.
 *
 * Images are the bundled SVGs under `public/images/seed`, so no upload storage is
 * needed to see the menu.
 */
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { openingStockEntry } from "@/src/domain/entities/Inventory";
import { isPlausiblePhone, normalizePhone } from "@/src/domain/entities/Phone";
import { recipeCost } from "@/src/domain/entities/Pricing";
import { prisma } from "@/src/infrastructure/prisma/client";
import { PrismaInventoryRepository } from "@/src/infrastructure/repositories/PrismaInventoryRepository";

const img = (name: string) => `/images/seed/${name}.svg`;

type SeedCategory = { slug: string; name: string; fa: string; icon: string };

const CATEGORIES: SeedCategory[] = [
  { slug: "hot-drinks", name: "Hot drinks", fa: "نوشیدنی‌های گرم", icon: "icon-hot-drinks" },
  { slug: "cold-drinks", name: "Cold drinks", fa: "نوشیدنی‌های سرد", icon: "icon-cold-drinks" },
  { slug: "cakes", name: "Cakes & sweets", fa: "کیک و شیرینی", icon: "icon-cakes" },
  { slug: "breakfast", name: "Breakfast", fa: "صبحانه", icon: "icon-breakfast" },
  { slug: "books", name: "Books", fa: "کتاب‌ها", icon: "icon-books" },
];

type SeedItem = {
  id: string;
  category: string;
  kind: "drink" | "food" | "book";
  name: string;
  fa: { name: string; unit?: string; description?: string };
  price: number;
  originalPrice?: number;
  stock: number;
  image: string;
  featured?: boolean;
  badge?: string;
  unit?: string;
  description?: string;
  origin?: string;
  nutrition?: string;
  dietary?: string[];
  book?: { author: string; isbn?: string; availability: "sale" | "reading" | "both" };
};

const ITEMS: SeedItem[] = [
  {
    id: "seed-espresso",
    category: "hot-drinks",
    kind: "drink",
    name: "Espresso",
    fa: { name: "اسپرسو", unit: "دبل", description: "دبل شات از بلند خانه، غلیظ و شکلاتی." },
    price: 95000,
    stock: 200,
    image: img("espresso"),
    unit: "Double shot",
    description: "A double shot of our house blend — dense, chocolatey, short.",
    origin: "House blend: Brazil Cerrado and Ethiopia Sidamo.",
    dietary: ["Vegan", "Sugar-Free"],
  },
  {
    id: "seed-cappuccino",
    category: "hot-drinks",
    kind: "drink",
    name: "Cappuccino",
    fa: { name: "کاپوچینو", unit: "۲۴۰ میلی‌لیتر", description: "دبل اسپرسو با شیر بخارداده و فوم ضخیم." },
    price: 145000,
    stock: 200,
    image: img("cappuccino"),
    featured: true,
    unit: "240 ml",
    description: "Double espresso, steamed milk and a thick cap of foam. Ask for oat milk.",
    nutrition: "Contains milk. About 130 kcal.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-saffron-latte",
    category: "hot-drinks",
    kind: "drink",
    name: "Saffron Latte",
    fa: { name: "لاته زعفرانی", unit: "۳۰۰ میلی‌لیتر", description: "لاته با شربت زعفران و گلاب خانگی." },
    price: 175000,
    stock: 120,
    image: img("saffron-latte"),
    featured: true,
    badge: "New",
    unit: "300 ml",
    description: "Our latte with house saffron-and-rosewater syrup.",
    nutrition: "Contains milk. About 210 kcal.",
    dietary: ["Vegetarian", "Gluten-Free"],
  },
  {
    id: "seed-persian-tea",
    category: "hot-drinks",
    kind: "drink",
    name: "Persian Tea Pot",
    fa: { name: "قوری چای ایرانی", unit: "برای دو نفر", description: "چای لاهیجان دم‌کرده، با نبات زعفرانی." },
    price: 120000,
    stock: 150,
    image: img("persian-tea"),
    unit: "Serves two",
    description: "Brewed Lahijan black tea with saffron rock candy on the side.",
    origin: "Lahijan, Gilan.",
    dietary: ["Vegan", "Gluten-Free", "Dairy-Free"],
  },
  {
    id: "seed-iced-spanish-latte",
    category: "cold-drinks",
    kind: "drink",
    name: "Iced Spanish Latte",
    fa: { name: "لاته اسپانیایی سرد", unit: "۳۵۰ میلی‌لیتر", description: "دبل اسپرسو روی شیر عسلی و یخ." },
    price: 185000,
    stock: 120,
    image: img("iced-spanish-latte"),
    featured: true,
    unit: "350 ml",
    description: "Double espresso over condensed milk and ice.",
    nutrition: "Contains milk. About 220 kcal.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-mint-lemonade",
    category: "cold-drinks",
    kind: "drink",
    name: "Mint Lemonade",
    fa: { name: "لیموناد نعنا", unit: "۴۰۰ میلی‌لیتر", description: "لیموی تازه، نعنای تازه و کمی عسل." },
    price: 130000,
    stock: 100,
    image: img("mint-lemonade"),
    unit: "400 ml",
    description: "Fresh lemon, fresh mint, a little honey.",
    dietary: ["Vegetarian", "Gluten-Free", "Dairy-Free", "Caffeine-Free"],
  },
  {
    id: "seed-saffron-cake",
    category: "cakes",
    kind: "food",
    name: "Saffron Cake",
    fa: { name: "کیک زعفرانی", unit: "یک برش", description: "کیک خانگی زعفران و پسته." },
    price: 110000,
    originalPrice: 130000,
    stock: 24,
    image: img("saffron-cake"),
    featured: true,
    badge: "Offer",
    unit: "One slice",
    description: "House saffron and pistachio cake, baked every morning.",
    nutrition: "Contains eggs, milk, wheat and nuts.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-carrot-cake",
    category: "cakes",
    kind: "food",
    name: "Carrot Cake",
    fa: { name: "کیک هویج", unit: "یک برش", description: "کیک هویج و گردو با رویهٔ پنیر خامه‌ای." },
    price: 120000,
    stock: 18,
    image: img("carrot-cake"),
    unit: "One slice",
    description: "Carrot and walnut cake with cream-cheese frosting.",
    nutrition: "Contains eggs, milk, wheat and nuts.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-omelette",
    category: "breakfast",
    kind: "food",
    name: "Herb Omelette",
    fa: { name: "املت سبزیجات", description: "سه تخم‌مرغ با سبزی تازه، نان سنگک و گوجه." },
    price: 210000,
    stock: 30,
    image: img("omelette"),
    description: "Three eggs with fresh herbs, served with sangak bread and tomatoes.",
    nutrition: "Contains eggs and wheat.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-breakfast-plate",
    category: "breakfast",
    kind: "food",
    name: "Persian Breakfast Plate",
    fa: { name: "صبحانهٔ ایرانی", description: "پنیر، گردو، سبزی، خرما، عسل و کره با نان تازه." },
    price: 260000,
    stock: 30,
    image: img("breakfast-plate"),
    featured: true,
    description: "Feta, walnuts, fresh herbs, dates, honey and butter with fresh bread.",
    nutrition: "Contains milk, wheat and nuts.",
    dietary: ["Vegetarian"],
  },
  {
    id: "seed-book-blind-owl",
    category: "books",
    kind: "book",
    name: "The Blind Owl",
    fa: { name: "بوف کور", unit: "جلد شومیز", description: "شاهکار صادق هدایت؛ روایتی کابوس‌وار از تنهایی." },
    price: 280000,
    stock: 6,
    image: img("book-blind-owl"),
    featured: true,
    unit: "Paperback",
    description: "Sadegh Hedayat's masterpiece — a haunting, dreamlike novel of solitude.",
    book: { author: "Sadegh Hedayat", isbn: "9789643511180", availability: "both" },
  },
  {
    id: "seed-book-savushun",
    category: "books",
    kind: "book",
    name: "Savushun",
    fa: { name: "سووشون", unit: "جلد سخت", description: "رمان سیمین دانشور؛ شیراز در سال‌های جنگ." },
    price: 350000,
    stock: 2,
    image: img("book-savushun"),
    unit: "Hardcover",
    description: "Simin Daneshvar's novel of Shiraz in the war years. Our reading copy — enjoy it with a coffee.",
    book: { author: "Simin Daneshvar", availability: "reading" },
  },
  {
    id: "seed-book-uncle-napoleon",
    category: "books",
    kind: "book",
    name: "My Uncle Napoleon",
    fa: { name: "دایی جان ناپلئون", unit: "جلد شومیز", description: "طنز بی‌نظیر ایرج پزشکزاد." },
    price: 420000,
    stock: 4,
    image: img("book-uncle-napoleon"),
    unit: "Paperback",
    description: "Iraj Pezeshkzad's beloved comic novel.",
    book: { author: "Iraj Pezeshkzad", availability: "sale" },
  },
];

/** The next given weekday (0 = Sunday … 6 = Saturday) at least `minDays` ahead, on the cafe calendar. */
function nextWeekday(weekday: number, minDays: number): string {
  let day = shiftCafeDay(cafeDayOf(new Date()), minDays);
  // Noon cafe time is still the same calendar day in UTC, so getUTCDay is safe.
  while (wallTimeToDate(`${day}T12:00`).getUTCDay() !== weekday) day = shiftCafeDay(day, 1);
  return day;
}

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, name: category.name, iconUrl: img(category.icon), isActive: true },
      update: { name: category.name, iconUrl: img(category.icon) },
    });
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: row.id, locale: "fa" } },
      create: { categoryId: row.id, locale: "fa", name: category.fa },
      update: { name: category.fa },
    });
    ids.set(category.slug, row.id);
  }
  return ids;
}

/** Rough share of the price an item costs the cafe, for sample margins. */
const COST_RATIO: Record<SeedItem["kind"], number> = { drink: 0.3, food: 0.4, book: 0.65 };

async function seedItems(categoryIds: Map<string, string>): Promise<void> {
  for (const item of ITEMS) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`Unknown category ${item.category}`);
    const data = {
      kind: item.kind,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice ?? null,
      costPrice: Math.round((item.price * COST_RATIO[item.kind]) / 1000) * 1000,
      taxExempt: item.kind === "book",
      stockQuantity: item.stock,
      imageUrl: item.image,
      categoryId,
      isFeatured: item.featured ?? false,
      isPublished: true,
      badge: item.badge ?? null,
      unit: item.unit ?? null,
      description: item.description ?? null,
      nutrition: item.nutrition ?? null,
      origin: item.origin ?? null,
      dietary: item.dietary ?? [],
      bookAuthor: item.book?.author ?? null,
      bookIsbn: item.book?.isbn ?? null,
      bookAvailability: item.book?.availability ?? null,
    };
    await prisma.product.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
    const fa = { name: item.fa.name, unit: item.fa.unit ?? null, description: item.fa.description ?? null };
    await prisma.productTranslation.upsert({
      where: { productId_locale: { productId: item.id, locale: "fa" } },
      create: { productId: item.id, locale: "fa", ...fa },
      update: fa,
    });
  }
}

async function seedEvents(): Promise<void> {
  const bookClubDay = nextWeekday(4, 2); // Thursday, at least two days out
  const readingDay = nextWeekday(1, 9); // Monday, at least nine days out

  const events = [
    {
      id: "seed-event-book-club",
      kind: "bookClub",
      title: "Book club: The Blind Owl",
      titleFa: "باشگاه کتاب: بوف کور",
      description: "We read Hedayat's The Blind Owl this month. Come with your copy (or borrow ours) and your questions. Tea is on us.",
      descriptionFa: "این ماه «بوف کور» هدایت را می‌خوانیم. با کتابتان (یا نسخهٔ کافه) و پرسش‌هایتان بیایید. چای مهمان ما.",
      imageUrl: img("event-book-club"),
      startsAt: wallTimeToDate(`${bookClubDay}T18:30`),
      endsAt: wallTimeToDate(`${bookClubDay}T20:30`),
      capacity: 20,
      price: 0,
      isPublished: true,
    },
    {
      id: "seed-event-reading",
      kind: "reading",
      title: "Poetry night: Forough Farrokhzad",
      titleFa: "شب شعر: فروغ فرخزاد",
      description: "An evening of readings from Forough's poems, with live setar. The ticket includes a drink.",
      descriptionFa: "شبی با خوانش اشعار فروغ همراه با سه‌تار زنده. بلیت شامل یک نوشیدنی است.",
      imageUrl: img("event-reading"),
      startsAt: wallTimeToDate(`${readingDay}T19:00`),
      endsAt: wallTimeToDate(`${readingDay}T21:00`),
      capacity: 30,
      price: 150000,
      isPublished: true,
    },
  ];

  for (const { id, ...data } of events) {
    await prisma.event.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
}

async function seedOwner(ownerPhone: string | undefined): Promise<string | null> {
  const phone = ownerPhone?.trim();
  if (!phone) return null;
  if (!isPlausiblePhone(phone)) throw new Error(`Owner phone "${phone}" isn't a valid phone number.`);
  const id = normalizePhone(phone);
  // Keep any name the person already set; only make sure they own the dashboard.
  await prisma.user.upsert({
    where: { id },
    create: { id, phone, name: "Owner", role: "owner" },
    update: { role: "owner" },
  });
  return id;
}

/**
 * Sample stock at plausible Tehran prices: ingredients, and the resale goods
 * (books, cakes bought whole) that are sold one piece at a time. Each has a
 * reorder level and an opening quantity; a few are deliberately low or empty so
 * the low-stock warnings show on a fresh database.
 */
const STOCK_ITEMS = [
  { id: "seed-ing-beans", name: "Espresso beans", unit: "g", purchasePrice: 1_800_000, purchaseQuantity: 1000, reorderLevel: 2000, opening: 6000 },
  { id: "seed-ing-milk", name: "Milk", unit: "ml", purchasePrice: 70_000, purchaseQuantity: 1000, reorderLevel: 10_000, opening: 8000 },
  { id: "seed-ing-saffron", name: "Saffron", unit: "g", purchasePrice: 1_200_000, purchaseQuantity: 4, reorderLevel: 4, opening: 2 },
  { id: "seed-ing-tea", name: "Black tea", unit: "g", purchasePrice: 900_000, purchaseQuantity: 500, reorderLevel: 500, opening: 1500 },
  { id: "seed-ing-sugar", name: "Sugar", unit: "g", purchasePrice: 80_000, purchaseQuantity: 1000, reorderLevel: 2000, opening: 5000 },
  { id: "seed-ing-condensed", name: "Condensed milk", unit: "g", purchasePrice: 180_000, purchaseQuantity: 400, reorderLevel: 800, opening: 1600 },
  { id: "seed-ing-lemon", name: "Lemon juice", unit: "ml", purchasePrice: 150_000, purchaseQuantity: 1000, reorderLevel: 1000, opening: 3000 },
  { id: "seed-ing-mint", name: "Fresh mint", unit: "g", purchasePrice: 60_000, purchaseQuantity: 250, reorderLevel: 100, opening: 0 },
  { id: "seed-ing-cup", name: "Cold cup and lid", unit: "piece", purchasePrice: 400_000, purchaseQuantity: 50, reorderLevel: 50, opening: 200 },
  { id: "seed-ing-eggs", name: "Eggs", unit: "piece", purchasePrice: 750_000, purchaseQuantity: 30, reorderLevel: 30, opening: 90 },
  { id: "seed-ing-bread", name: "Barbari bread", unit: "piece", purchasePrice: 20_000, purchaseQuantity: 1, reorderLevel: 5, opening: 12 },
  { id: "seed-ing-cheese", name: "Lighvan cheese", unit: "g", purchasePrice: 500_000, purchaseQuantity: 1000, reorderLevel: 500, opening: 2000 },
  { id: "seed-ing-saffron-cake", name: "Saffron cake (slice)", unit: "piece", purchasePrice: 440_000, purchaseQuantity: 10, reorderLevel: 4, opening: 10 },
  { id: "seed-ing-carrot-cake", name: "Carrot cake (slice)", unit: "piece", purchasePrice: 480_000, purchaseQuantity: 10, reorderLevel: 4, opening: 3 },
  { id: "seed-ing-book-blind-owl", name: "The Blind Owl (copy)", unit: "piece", purchasePrice: 182_000, purchaseQuantity: 1, reorderLevel: 2, opening: 6 },
  { id: "seed-ing-book-savushun", name: "Savushun (copy)", unit: "piece", purchasePrice: 228_000, purchaseQuantity: 1, reorderLevel: 2, opening: 5 },
  { id: "seed-ing-book-uncle-napoleon", name: "My Uncle Napoleon (copy)", unit: "piece", purchasePrice: 273_000, purchaseQuantity: 1, reorderLevel: 2, opening: 2 },
] as const;

const RECIPES: Record<string, { ingredientId: string; quantity: number }[]> = {
  "seed-espresso": [{ ingredientId: "seed-ing-beans", quantity: 18 }],
  "seed-cappuccino": [
    { ingredientId: "seed-ing-beans", quantity: 18 },
    { ingredientId: "seed-ing-milk", quantity: 150 },
  ],
  "seed-saffron-latte": [
    { ingredientId: "seed-ing-beans", quantity: 18 },
    { ingredientId: "seed-ing-milk", quantity: 200 },
    { ingredientId: "seed-ing-saffron", quantity: 0.1 },
    { ingredientId: "seed-ing-sugar", quantity: 10 },
  ],
  "seed-persian-tea": [
    { ingredientId: "seed-ing-tea", quantity: 6 },
    { ingredientId: "seed-ing-sugar", quantity: 15 },
  ],
  "seed-iced-spanish-latte": [
    { ingredientId: "seed-ing-beans", quantity: 18 },
    { ingredientId: "seed-ing-milk", quantity: 150 },
    { ingredientId: "seed-ing-condensed", quantity: 30 },
    { ingredientId: "seed-ing-cup", quantity: 1 },
  ],
  "seed-mint-lemonade": [
    { ingredientId: "seed-ing-lemon", quantity: 60 },
    { ingredientId: "seed-ing-mint", quantity: 5 },
    { ingredientId: "seed-ing-sugar", quantity: 30 },
    { ingredientId: "seed-ing-cup", quantity: 1 },
  ],
  "seed-omelette": [
    { ingredientId: "seed-ing-eggs", quantity: 3 },
    { ingredientId: "seed-ing-bread", quantity: 1 },
  ],
  "seed-breakfast-plate": [
    { ingredientId: "seed-ing-eggs", quantity: 2 },
    { ingredientId: "seed-ing-bread", quantity: 1 },
    { ingredientId: "seed-ing-cheese", quantity: 60 },
  ],
  // Resale goods: one piece per sale.
  "seed-saffron-cake": [{ ingredientId: "seed-ing-saffron-cake", quantity: 1 }],
  "seed-carrot-cake": [{ ingredientId: "seed-ing-carrot-cake", quantity: 1 }],
  "seed-book-blind-owl": [{ ingredientId: "seed-ing-book-blind-owl", quantity: 1 }],
  "seed-book-savushun": [{ ingredientId: "seed-ing-book-savushun", quantity: 1 }],
  "seed-book-uncle-napoleon": [{ ingredientId: "seed-ing-book-uncle-napoleon", quantity: 1 }],
};

async function seedRecipes(): Promise<void> {
  for (const { opening: _opening, ...item } of STOCK_ITEMS) {
    const { id, ...data } = item;
    await prisma.ingredient.upsert({ where: { id }, create: item, update: data });
  }
  const byId = new Map<string, { purchasePrice: number; purchaseQuantity: number }>(STOCK_ITEMS.map((item) => [item.id, item]));
  for (const [productId, lines] of Object.entries(RECIPES)) {
    await prisma.recipeLine.deleteMany({ where: { productId } });
    await prisma.recipeLine.createMany({ data: lines.map((line, position) => ({ productId, ...line, position })) });
    // The item's cost price follows its recipe, as it does when edited in the dashboard.
    const cost = recipeCost(lines, byId);
    if (cost !== null) await prisma.product.update({ where: { id: productId }, data: { costPrice: cost } });
  }

  // Opening stock goes through the real path (stock movements + the journal entry),
  // so stock and the Inventory account agree from the start. Only on a fresh stock.
  if ((await prisma.stockMovement.count()) === 0) {
    const lines = STOCK_ITEMS.filter((item) => item.opening > 0).map((item) => ({
      ingredientId: item.id,
      quantity: item.opening,
      cost: Math.round((item.purchasePrice / item.purchaseQuantity) * item.opening),
    }));
    const actor = { id: "seed", name: "Seed" };
    await new PrismaInventoryRepository().recordOpening({ date: cafeDayOf(new Date()), lines }, (event) => openingStockEntry(event, actor), actor);
  }
}

export type SeedSummary = { categories: number; items: number; events: number; ownerId: string | null };

/** Load (or refresh) the sample data; an `ownerPhone` also makes that phone the owner. */
export async function seedSampleData(ownerPhone?: string): Promise<SeedSummary> {
  const categoryIds = await seedCategories();
  await seedItems(categoryIds);
  await seedRecipes();
  await seedEvents();
  const ownerId = await seedOwner(ownerPhone);
  return { categories: CATEGORIES.length, items: ITEMS.length, events: 2, ownerId };
}
