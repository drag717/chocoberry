import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Heart,
  Home,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserCog,
} from 'lucide-react';
import defaultProducts from './data/products.json';
import defaultReviews from './data/reviews.json';
import defaultGallery from './data/gallery.json';
import contacts from './data/contacts.json';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  size: string;
  composition: string;
  description: string;
  image: string;
  images?: string[];
  tags: string[];
  popular: boolean;
};

type Review = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
};

type GalleryItem = {
  id: string;
  title: string;
  image: string;
  height: 'short' | 'medium' | 'tall';
};

type ContactData = {
  address: string;
  whatsappLabel: string;
  whatsappUrl: string;
  instagramLabel: string;
  instagramUrl: string;
  schedule: string;
};

type AppData = {
  products: Product[];
  reviews: Review[];
  galleryItems: GalleryItem[];
  contacts: ContactData;
};

type Tab = 'home' | 'catalog' | 'gallery' | 'reviews' | 'contacts' | 'admin';

const productsSeed = defaultProducts as Product[];
const reviewsSeed = defaultReviews as Review[];
const gallerySeed = defaultGallery as GalleryItem[];
const contactsSeed = contacts as ContactData;

const categories = ['Все', 'Букеты из клубники', 'Клубника в шоколаде', 'Фруктовые боксы', 'Вафли', 'Десерты', 'Напитки'];
const budgetOptions = ['До 1500 ₽', 'До 3000 ₽', 'До 5000 ₽', 'Более 5000 ₽'];
const whatsappUrl = contactsSeed.whatsappUrl;

const quizSteps = [
  {
    title: 'Кому подарок?',
    options: ['Девушке ❤️', 'Жене 💍', 'Маме 🌷', 'Сестре 🎁', 'Подруге 🎀', 'Коллеге 🎉'],
  },
  {
    title: 'Повод?',
    options: ['День рождения 🎂', 'Без повода ❤️', 'Годовщина 💍', 'Свидание 🌹', 'Извинение 🙏', 'Сюрприз 🎁'],
  },
  {
    title: 'Бюджет?',
    options: budgetOptions,
  },
  {
    title: 'Что важнее?',
    options: ['Красота и оформление ✨', 'Много клубники 🍓', 'Премиум подарок 👑', 'Большой размер 📦'],
  },
];

const emptyProduct: Product = {
  id: '',
  name: '',
  category: 'Букеты из клубники',
  price: 1500,
  size: '',
  composition: '',
  description: '',
  image: '',
  tags: [],
  popular: false,
};

const emptyReview: Review = {
  id: '',
  name: '',
  role: '',
  text: '',
  rating: 5,
};

const emptyGalleryItem: GalleryItem = {
  id: '',
  title: '',
  image: '',
  height: 'medium',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem('chocoberry-admin-token');
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('content-type', headers.get('content-type') || 'application/json');
  }
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

async function saveServerData(path: string, value: unknown) {
  await apiRequest(path, { method: 'PUT', body: JSON.stringify(value) });
}

async function uploadImage(file: File) {
  const dataUrl = await fileToDataUrl(file);
  try {
    const result = await apiRequest<{ url: string }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, dataUrl }),
    });
    return result.url;
  } catch {
    return dataUrl;
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readProductsInitial() {
  const stored = readStorage<Product[]>('chocoberry-products', productsSeed);
  return stored.length >= productsSeed.length ? stored : productsSeed;
}

function readReviewsInitial() {
  const stored = readStorage<Review[]>('chocoberry-reviews', reviewsSeed);
  const hasOldPlaceholders = stored.some((review) => ['review-1', 'review-2', 'review-3'].includes(review.id));
  return hasOldPlaceholders ? reviewsSeed : stored;
}

function readGalleryInitial() {
  const stored = readStorage<GalleryItem[]>('chocoberry-gallery', gallerySeed);
  const hasOldPlaceholders = stored.some((item) => /^gallery-[1-6]$/.test(item.id));
  return hasOldPlaceholders ? gallerySeed : stored;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function budgetLimit(answer?: string) {
  if (answer === 'До 1500 ₽') return 1500;
  if (answer === 'До 3000 ₽') return 3000;
  if (answer === 'До 5000 ₽') return 5000;
  return Number.POSITIVE_INFINITY;
}

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === '#admin');
  const [products, setProducts] = useState<Product[]>(readProductsInitial);
  const [reviews, setReviews] = useState<Review[]>(readReviewsInitial);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(readGalleryInitial);
  const [contactData, setContactData] = useState<ContactData>(contactsSeed);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [category, setCategory] = useState('Все');
  const catalogPriceMax = useMemo(() => Math.max(...products.map((product) => product.price), 100), [products]);
  const [priceMax, setPriceMax] = useState(catalogPriceMax);

  useEffect(() => {
    setPriceMax((value) => Math.min(Math.max(value, 100), catalogPriceMax));
  }, [catalogPriceMax]);

  useEffect(() => {
    const syncRoute = () => {
      const adminRoute = window.location.hash === '#admin';
      setIsAdminRoute(adminRoute);
      setTab(adminRoute ? 'admin' : 'home');
    };
    window.addEventListener('hashchange', syncRoute);
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    apiRequest<AppData>('/api/data')
      .then((data) => {
        setProducts(data.products);
        setReviews(data.reviews);
        setGalleryItems(data.galleryItems);
        setContactData(data.contacts);
      })
      .catch(() => {
        // Static preview fallback: imported JSON keeps the app usable without the server.
      });
  }, []);

  const popular = products.filter((product) => product.popular).slice(0, 4);

  const recommendations = useMemo(() => {
    const limit = budgetLimit(answers[2]);
    return [...products]
      .map((product) => ({
        product,
        score:
          product.tags.filter((tag) => answers.includes(tag)).length * 4 +
          (product.price <= limit ? 3 : -5) +
          (product.popular ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
      .slice(0, 3)
      .map(({ product }) => product);
  }, [answers, products]);

  const filteredProducts = products.filter((product) => {
    const categoryMatch = category === 'Все' || product.category === category;
    return categoryMatch && product.price <= priceMax;
  });

  const chooseAnswer = (answer: string) => {
    const next = [...answers];
    next[quizStep] = answer;
    setAnswers(next);
    if (quizStep < quizSteps.length - 1) {
      setQuizStep((value) => value + 1);
    } else {
      setQuizStep(quizSteps.length);
    }
  };

  const restartQuiz = () => {
    setAnswers([]);
    setQuizStep(0);
  };

  const persistProducts = async (next: Product[]) => {
    setProducts(next);
    saveStorage('chocoberry-products', next);
    await saveServerData('/api/products', next);
  };

  const persistReviews = async (next: Review[]) => {
    setReviews(next);
    saveStorage('chocoberry-reviews', next);
    await saveServerData('/api/reviews', next);
  };

  return (
    <main className="min-h-screen bg-cream text-chocolate-900">
      <div className="mx-auto min-h-screen w-full max-w-md bg-cream pb-24 shadow-premium md:max-w-5xl md:pb-10">
        <Header tab={tab} setTab={setTab} isAdminRoute={isAdminRoute} />

        {isAdminRoute ? (
          <AdminGate>
            <Admin
              products={products}
              reviews={reviews}
              galleryItems={galleryItems}
              onProducts={persistProducts}
              onReviews={persistReviews}
              onGalleryItems={async (next) => {
                setGalleryItems(next);
                saveStorage('chocoberry-gallery', next);
                await saveServerData('/api/gallery', next);
              }}
            />
          </AdminGate>
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen
                popular={popular}
                reviews={reviews}
                onStart={() => {
                  setQuizOpen(true);
                  restartQuiz();
                }}
              />
            )}
            {tab === 'catalog' && (
              <Catalog
                products={filteredProducts}
                category={category}
                priceMax={priceMax}
                catalogPriceMax={catalogPriceMax}
                setCategory={setCategory}
                setPriceMax={setPriceMax}
              />
            )}
            {tab === 'gallery' && <Gallery items={galleryItems} />}
            {tab === 'reviews' && <Reviews reviews={reviews} />}
            {tab === 'contacts' && <Contacts contacts={contactData} />}
          </>
        )}

        {quizOpen && (
          <QuizModal
            step={quizStep}
            answers={answers}
            recommendations={recommendations}
            onClose={() => setQuizOpen(false)}
            onAnswer={chooseAnswer}
            onRestart={restartQuiz}
          />
        )}

        {!isAdminRoute && <BottomNav active={tab} onChange={setTab} />}
      </div>
    </main>
  );
}

function Header({ tab, setTab, isAdminRoute }: { tab: Tab; setTab: (tab: Tab) => void; isAdminRoute: boolean }) {
  const desktopItems: Array<{ tab: Tab; label: string }> = [
    { tab: 'home', label: 'Главная' },
    { tab: 'catalog', label: 'Каталог' },
    { tab: 'gallery', label: 'Работы' },
    { tab: 'reviews', label: 'Отзывы' },
    { tab: 'contacts', label: 'Контакты' },
  ];

  return (
    <header className="sticky top-0 z-30 glass border-b border-berry-900/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2"
          onClick={() => {
            if (isAdminRoute) window.location.hash = '';
            setTab('home');
          }}
          aria-label="На главную"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-berry-700 text-white shadow-soft">CB</span>
          <span>
            <span className="block font-display text-2xl font-bold leading-none text-berry-900">ChocoBerry</span>
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-chocolate-500">Gift Atelier</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {!isAdminRoute && (
          <nav className="hidden items-center gap-1 md:flex">
            {desktopItems.map((item) => (
              <button
                key={item.tab}
                className={`h-10 rounded-full px-4 text-sm font-extrabold ${tab === item.tab ? 'bg-berry-700 text-white' : 'text-chocolate-700 hover:bg-white'}`}
                onClick={() => setTab(item.tab)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          )}
          {isAdminRoute && (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-berry-700 text-white premium-border" title="Админ панель">
              <UserCog size={19} />
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function HomeScreen({ popular, reviews, onStart }: { popular: Product[]; reviews: Review[]; onStart: () => void }) {
  return (
    <section className="animate-fadeUp">
      <div className="relative overflow-hidden bg-chocolate-900 px-5 pb-8 pt-8 text-white">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          src="https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=1200&q=90"
          alt="Букет из клубники ChocoBerry"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-chocolate-900/30 via-chocolate-900/55 to-chocolate-900" />
        <div className="relative min-h-[500px] pt-14 sm:pt-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-sm font-semibold backdrop-blur">
            <Sparkles size={16} /> Подарочный помощник
          </div>
          <h1 className="max-w-sm font-display text-4xl font-bold leading-[1.02] sm:text-5xl sm:leading-[0.94]">
            🍓 Подберем идеальный подарок за 30 секунд
          </h1>
          <p className="mt-5 max-w-xs text-base leading-7 text-white/84">
            Ответьте на несколько вопросов, и мы предложим лучший вариант.
          </p>
          <button
            onClick={onStart}
            className="mt-7 inline-flex h-14 items-center gap-3 rounded-full bg-white px-6 text-base font-extrabold text-berry-900 shadow-premium transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <Gift size={21} /> Начать подбор
          </button>
        </div>
      </div>

      <SectionTitle eyebrow="Выбор клиентов" title="Популярные подарки" />
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
        {popular.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>

      <SectionTitle eyebrow="Живые эмоции" title="Отзывы клиентов" />
      <div className="grid gap-3 px-4 md:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="px-4 pb-3 pt-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl font-bold text-chocolate-900">{title}</h2>
    </div>
  );
}

function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const image = product.images?.[0] || product.image;

  return (
    <article className={`${compact ? 'w-64 shrink-0' : ''} overflow-hidden rounded-lg bg-white shadow-soft premium-border`}>
      <img className="h-44 w-full object-cover" src={image} alt={product.name} />
      <div className="space-y-3 p-4">
        <div className="grid gap-2 min-[380px]:flex min-[380px]:items-start min-[380px]:justify-between min-[380px]:gap-3">
          <h3 className="min-w-0 text-lg font-extrabold leading-tight">{product.name}</h3>
          <span className="w-fit rounded-full bg-berry-50 px-3 py-1 text-sm font-extrabold text-berry-700 min-[380px]:shrink-0">{formatPrice(product.price)}</span>
        </div>
        <p className="text-sm leading-6 text-chocolate-700">{product.description}</p>
        <div className="grid gap-2 text-xs text-chocolate-500">
          <span><b className="text-chocolate-900">Размер:</b> {product.size}</span>
          <span><b className="text-chocolate-900">Состав:</b> {product.composition}</span>
        </div>
        <OrderButtons product={product.name} />
      </div>
    </article>
  );
}

function OrderButtons({ product }: { product: string }) {
  const encoded = encodeURIComponent(`Здравствуйте! Хочу заказать ${product} в ChocoBerry`);
  return (
    <div>
      <a
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-berry-700 px-3 text-sm font-bold text-white"
        href={`${whatsappUrl}?text=${encoded}`}
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle size={16} /> Заказать через WhatsApp
      </a>
    </div>
  );
}

function QuizModal({
  step,
  answers,
  recommendations,
  onClose,
  onAnswer,
  onRestart,
}: {
  step: number;
  answers: string[];
  recommendations: Product[];
  onClose: () => void;
  onAnswer: (answer: string) => void;
  onRestart: () => void;
}) {
  const isResult = step >= quizSteps.length;
  return (
    <div className="fixed inset-0 z-50 bg-chocolate-900/50 p-3 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-md flex-col overflow-hidden rounded-lg bg-cream shadow-premium md:max-w-3xl">
        <div className="flex items-center justify-between border-b border-berry-900/10 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Подбор подарка</p>
            <h2 className="font-display text-2xl font-bold">{isResult ? 'Готово' : `Шаг ${step + 1} из 4`}</h2>
          </div>
          <button className="rounded-full bg-white px-4 py-2 text-sm font-bold premium-border" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {!isResult ? (
            <div className="animate-fadeUp">
              <div className="mb-5 h-2 overflow-hidden rounded-full bg-berry-100">
                <div className="h-full rounded-full bg-berry-700 transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
              </div>
              <h3 className="mb-4 font-display text-4xl font-bold">{quizSteps[step].title}</h3>
              <div className="grid gap-3">
                {quizSteps[step].options.map((option) => (
                  <button
                    key={option}
                    className="flex min-h-16 items-center justify-between rounded-lg bg-white px-4 text-left text-lg font-bold shadow-soft premium-border transition hover:-translate-y-0.5 hover:border-berry-600"
                    onClick={() => onAnswer(option)}
                  >
                    {option}
                    <Heart className="text-berry-600" size={20} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fadeUp">
              <h3 className="font-display text-4xl font-bold leading-tight">Мы подобрали для вас идеальный подарок</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {answers.map((answer) => (
                  <span key={answer} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-chocolate-700 premium-border">
                    {answer}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid gap-4">
                {recommendations.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <button className="mt-5 w-full rounded-full bg-white py-4 font-extrabold text-berry-700 premium-border" onClick={onRestart}>
                Подобрать заново
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Catalog({
  products,
  category,
  priceMax,
  catalogPriceMax,
  setCategory,
  setPriceMax,
}: {
  products: Product[];
  category: string;
  priceMax: number;
  catalogPriceMax: number;
  setCategory: (category: string) => void;
  setPriceMax: (price: number) => void;
}) {
  return (
    <section className="animate-fadeUp px-4 py-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Каталог</p>
          <h1 className="font-display text-4xl font-bold">Ассортимент</h1>
        </div>
        <SlidersHorizontal className="text-berry-700" />
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`h-11 shrink-0 rounded-full px-4 text-sm font-bold premium-border ${category === item ? 'bg-berry-700 text-white' : 'bg-white text-chocolate-700'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="mb-5 block rounded-lg bg-white p-4 shadow-soft premium-border">
        <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
          Фильтр по цене <b className="text-base text-berry-700">{formatPrice(priceMax)}</b>
        </span>
        <input
          className="mt-4 w-full accent-berry-700"
          type="range"
          min="100"
          max={catalogPriceMax}
          step="50"
          value={priceMax}
          onChange={(event) => setPriceMax(Number(event.target.value))}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function Gallery({ items }: { items: GalleryItem[] }) {
  const heightClass = { short: 'h-44', medium: 'h-60', tall: 'h-80' };
  return (
    <section className="animate-fadeUp px-4 py-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Наши работы</p>
      <h1 className="mb-5 font-display text-4xl font-bold">Галерея подарков</h1>
      {items.length ? (
        <div className="masonry">
          {items.map((item) => (
            <figure key={item.id} className="mb-3 break-inside-avoid overflow-hidden rounded-lg bg-white shadow-soft premium-border">
              <img className={`${heightClass[item.height]} w-full object-cover`} src={item.image} alt={item.title} />
              <figcaption className="px-3 py-3 text-sm font-bold">{item.title}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 text-center text-lg font-extrabold text-chocolate-600 shadow-soft premium-border">
          Работы скоро появятся
        </div>
      )}
    </section>
  );
}

function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <section className="animate-fadeUp px-4 py-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Отзывы</p>
      <h1 className="mb-5 font-display text-4xl font-bold">Клиенты о ChocoBerry</h1>
      {reviews.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 text-center text-lg font-extrabold text-chocolate-600 shadow-soft premium-border">
          Отзывы скоро появятся
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-soft premium-border">
      <div className="mb-3 flex gap-1 text-berry-600">
        {Array.from({ length: review.rating }).map((_, index) => (
          <Star key={index} size={17} fill="currentColor" />
        ))}
      </div>
      <p className="text-sm leading-6 text-chocolate-700">“{review.text}”</p>
      <div className="mt-4">
        <b>{review.name}</b>
        <span className="block text-xs font-semibold text-chocolate-500">{review.role}</span>
      </div>
    </article>
  );
}

function Contacts({ contacts }: { contacts: ContactData }) {
  return (
    <section className="animate-fadeUp px-4 py-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Контакты</p>
      <h1 className="mb-5 font-display text-4xl font-bold">Свяжитесь с нами</h1>
      <div className="overflow-hidden rounded-lg bg-white shadow-soft premium-border">
        <div className="relative h-60 bg-chocolate-900">
          <img
            className="h-full w-full object-cover opacity-75"
            src="https://images.unsplash.com/photo-1559622214-f8a9850965bb?auto=format&fit=crop&w=1000&q=85"
            alt="Витрина кондитерской ChocoBerry"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-chocolate-900 p-4 text-white">
            <h2 className="font-display text-3xl font-bold">ChocoBerry Atelier</h2>
            <p className="text-sm text-white/82">Подарки из клубники и шоколада</p>
          </div>
        </div>
        <div className="grid gap-3 p-4 text-sm">
          <ContactLine label="Адрес" value={contacts.address} />
          <ContactLink label="WhatsApp" value={contacts.whatsappLabel} href={contacts.whatsappUrl} />
          <ContactLink label="Instagram" value={contacts.instagramLabel} href={contacts.instagramUrl} />
          <ContactLine label="График" value={contacts.schedule} />
        </div>
      </div>
    </section>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-chocolate-900/8 pb-3 min-[380px]:flex min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-4">
      <span className="font-bold text-chocolate-500">{label}</span>
      <span className="font-extrabold leading-5 min-[380px]:text-right">{value}</span>
    </div>
  );
}

function ContactLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      className="grid gap-1 border-b border-chocolate-900/8 pb-3 min-[380px]:flex min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-4"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span className="font-bold text-chocolate-500">{label}</span>
      <span className="font-extrabold leading-5 text-berry-700 min-[380px]:text-right">{value}</span>
    </a>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAllowed, setIsAllowed] = useState(() => Boolean(window.localStorage.getItem('chocoberry-admin-token')));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await apiRequest<{ token: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      window.localStorage.setItem('chocoberry-admin-token', result.token);
      window.localStorage.setItem('chocoberry-admin', 'ok');
      setIsAllowed(true);
      setError('');
      return;
    } catch {
      setError('Неверный пароль');
    }
  };

  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <section className="animate-fadeUp px-4 py-8">
      <div className="mx-auto max-w-sm rounded-lg bg-white p-5 shadow-soft premium-border">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-berry-700 text-white">
          <UserCog size={22} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Админ панель</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Вход</h1>
        <p className="mt-3 text-sm leading-6 text-chocolate-600">
          Эта страница не показывается клиентам. Обычная витрина открывается без доступа к админке.
        </p>
        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-bold text-chocolate-600">
            Пароль
            <input
              className="h-12 rounded-lg border border-berry-900/10 bg-cream px-3 font-semibold text-chocolate-900 outline-none focus:border-berry-700"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm font-bold text-berry-700">{error}</p>}
          <button className="h-12 rounded-full bg-berry-700 font-extrabold text-white">Войти</button>
        </form>
      </div>
    </section>
  );
}

function Admin({
  products,
  reviews,
  galleryItems,
  onProducts,
  onReviews,
  onGalleryItems,
}: {
  products: Product[];
  reviews: Review[];
  galleryItems: GalleryItem[];
  onProducts: (products: Product[]) => void | Promise<void>;
  onReviews: (reviews: Review[]) => void | Promise<void>;
  onGalleryItems: (items: GalleryItem[]) => void | Promise<void>;
}) {
  const [productDraft, setProductDraft] = useState<Product>(emptyProduct);
  const [reviewDraft, setReviewDraft] = useState<Review>(emptyReview);
  const [galleryDraft, setGalleryDraft] = useState<GalleryItem>(emptyGalleryItem);

  const updateDraft = (field: keyof Product, value: string | number | boolean) => {
    setProductDraft((draft) => ({ ...draft, [field]: value }));
  };

  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    const id = productDraft.id || productDraft.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '');
    const images = productDraft.images?.length ? productDraft.images : [productDraft.image].filter(Boolean);
    const nextProduct = { ...productDraft, id: id || String(Date.now()), image: images[0] || productDraft.image, images, tags: productDraft.tags.length ? productDraft.tags : [productDraft.category] };
    const exists = products.some((product) => product.id === nextProduct.id);
    void onProducts(exists ? products.map((product) => (product.id === nextProduct.id ? nextProduct : product)) : [nextProduct, ...products]);
    setProductDraft(emptyProduct);
  };

  const submitReview = (event: FormEvent) => {
    event.preventDefault();
    const nextReview = { ...reviewDraft, id: reviewDraft.id || `review-${Date.now()}` };
    void onReviews([nextReview, ...reviews]);
    setReviewDraft(emptyReview);
  };

  const submitGalleryItem = (event: FormEvent) => {
    event.preventDefault();
    const nextItem = { ...galleryDraft, id: galleryDraft.id || `gallery-${Date.now()}` };
    const exists = galleryItems.some((item) => item.id === nextItem.id);
    void onGalleryItems(exists ? galleryItems.map((item) => (item.id === nextItem.id ? nextItem : item)) : [nextItem, ...galleryItems]);
    setGalleryDraft(emptyGalleryItem);
  };

  const loadPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadImage(file).then((image) => {
      setProductDraft((draft) => ({ ...draft, image, images: [image, ...(draft.images || []).filter((item) => item !== image)] }));
    });
  };

  const loadGalleryPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadImage(file).then((image) => setGalleryDraft((draft) => ({ ...draft, image })));
  };

  return (
    <section className="animate-fadeUp px-4 py-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-berry-700">Админ панель</p>
      <h1 className="mb-2 font-display text-4xl font-bold">Управление</h1>
      <p className="mb-5 text-sm leading-6 text-chocolate-600">
        Товары и отзывы сохраняются в браузере владельца. Исходный ассортимент лежит отдельно в JSON.
      </p>

      <form className="grid gap-3 rounded-lg bg-white p-4 shadow-soft premium-border" onSubmit={submitProduct}>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Plus size={18} /> Товар</h2>
        <AdminInput label="Название" value={productDraft.name} onChange={(value) => updateDraft('name', value)} />
        <select
          className="h-12 rounded-lg border border-berry-900/10 bg-cream px-3 font-semibold"
          value={productDraft.category}
          onChange={(event) => updateDraft('category', event.target.value)}
        >
          {categories.slice(1).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <AdminInput label="Цена" type="number" value={String(productDraft.price)} onChange={(value) => updateDraft('price', Number(value))} />
        <AdminInput label="Размер" value={productDraft.size} onChange={(value) => updateDraft('size', value)} />
        <AdminInput label="Состав" value={productDraft.composition} onChange={(value) => updateDraft('composition', value)} />
        <AdminInput label="Описание" value={productDraft.description} onChange={(value) => updateDraft('description', value)} />
        <AdminInput
          label="Фото URL"
          value={productDraft.image}
          onChange={(value) => setProductDraft((draft) => ({ ...draft, image: value, images: value ? [value, ...(draft.images || []).filter((item) => item !== value)] : draft.images }))}
        />
        <AdminInput
          label="Дополнительные фото URL через запятую"
          value={(productDraft.images || []).join(', ')}
          onChange={(value) => {
            const images = value.split(',').map((item) => item.trim()).filter(Boolean);
            setProductDraft((draft) => ({ ...draft, images, image: images[0] || draft.image }));
          }}
        />
        <label className="rounded-lg border border-dashed border-berry-700/30 bg-berry-50 p-3 text-sm font-bold text-berry-800">
          Загрузить фотографию
          <input className="mt-2 block w-full text-xs" type="file" accept="image/*" onChange={loadPhoto} />
        </label>
        <label className="flex items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={productDraft.popular} onChange={(event) => updateDraft('popular', event.target.checked)} />
          Популярный подарок
        </label>
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-berry-700 font-extrabold text-white">
          <Pencil size={17} /> Сохранить товар
        </button>
      </form>

      <div className="mt-5 grid gap-3">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-soft premium-border">
            <img className="h-16 w-16 rounded-md object-cover" src={product.images?.[0] || product.image} alt={product.name} />
            <div className="min-w-0 flex-1">
              <b className="block truncate">{product.name}</b>
              <span className="text-sm font-bold text-berry-700">{formatPrice(product.price)}</span>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-berry-50 text-berry-700" onClick={() => setProductDraft(product)} aria-label="Редактировать товар">
              <Pencil size={17} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-chocolate-900 text-white" onClick={() => void onProducts(products.filter((item) => item.id !== product.id))} aria-label="Удалить товар">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>

      <form className="mt-6 grid gap-3 rounded-lg bg-white p-4 shadow-soft premium-border" onSubmit={submitGalleryItem}>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><ImageIcon size={18} /> Фото в “Наши работы”</h2>
        <AdminInput label="Название" value={galleryDraft.title} onChange={(value) => setGalleryDraft((draft) => ({ ...draft, title: value }))} />
        <AdminInput label="Фото URL" value={galleryDraft.image} onChange={(value) => setGalleryDraft((draft) => ({ ...draft, image: value }))} />
        <label className="rounded-lg border border-dashed border-berry-700/30 bg-berry-50 p-3 text-sm font-bold text-berry-800">
          Загрузить фото для галереи
          <input className="mt-2 block w-full text-xs" type="file" accept="image/*" onChange={loadGalleryPhoto} />
        </label>
        <select
          className="h-12 rounded-lg border border-berry-900/10 bg-cream px-3 font-semibold"
          value={galleryDraft.height}
          onChange={(event) => setGalleryDraft((draft) => ({ ...draft, height: event.target.value as GalleryItem['height'] }))}
        >
          <option value="short">Низкое фото</option>
          <option value="medium">Среднее фото</option>
          <option value="tall">Высокое фото</option>
        </select>
        <button className="h-12 rounded-full bg-berry-700 font-extrabold text-white">Сохранить фото</button>
      </form>

      <div className="mt-5 grid gap-3">
        {galleryItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-soft premium-border">
            <img className="h-16 w-16 rounded-md object-cover" src={item.image} alt={item.title} />
            <div className="min-w-0 flex-1">
              <b className="block truncate">{item.title}</b>
              <span className="text-sm font-bold text-chocolate-500">Наши работы</span>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-berry-50 text-berry-700" onClick={() => setGalleryDraft(item)} aria-label="Редактировать фото">
              <Pencil size={17} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-chocolate-900 text-white" onClick={() => void onGalleryItems(galleryItems.filter((galleryItem) => galleryItem.id !== item.id))} aria-label="Удалить фото">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>

      <form className="mt-6 grid gap-3 rounded-lg bg-white p-4 shadow-soft premium-border" onSubmit={submitReview}>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Star size={18} /> Отзыв</h2>
        <AdminInput label="Имя" value={reviewDraft.name} onChange={(value) => setReviewDraft((draft) => ({ ...draft, name: value }))} />
        <AdminInput label="Контекст" value={reviewDraft.role} onChange={(value) => setReviewDraft((draft) => ({ ...draft, role: value }))} />
        <AdminInput label="Текст" value={reviewDraft.text} onChange={(value) => setReviewDraft((draft) => ({ ...draft, text: value }))} />
        <button className="h-12 rounded-full bg-chocolate-900 font-extrabold text-white">Добавить отзыв</button>
      </form>

      <div className="mt-5 grid gap-3">
        {reviews.map((review) => (
          <div key={review.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-soft premium-border">
            <div className="min-w-0 flex-1">
              <b className="block truncate">{review.name}</b>
              <span className="line-clamp-1 text-sm text-chocolate-500">{review.text}</span>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-chocolate-900 text-white" onClick={() => void onReviews(reviews.filter((item) => item.id !== review.id))} aria-label="Удалить отзыв">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-chocolate-600">
      {label}
      <input
        required
        className="h-12 rounded-lg border border-berry-900/10 bg-cream px-3 font-semibold text-chocolate-900 outline-none focus:border-berry-700"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ tab: Tab; label: string; icon: typeof Home }> = [
    { tab: 'home', label: 'Главная', icon: Home },
    { tab: 'catalog', label: 'Каталог', icon: ShoppingBag },
    { tab: 'gallery', label: 'Работы', icon: ImageIcon },
    { tab: 'reviews', label: 'Отзывы', icon: Star },
    { tab: 'contacts', label: 'Контакты', icon: MapPin },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-berry-900/10 bg-white/94 px-2 py-2 shadow-premium backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onChange(item.tab)}
              className={`grid min-h-14 place-items-center rounded-lg text-[11px] font-extrabold ${isActive ? 'bg-berry-700 text-white' : 'text-chocolate-600'}`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default App;
