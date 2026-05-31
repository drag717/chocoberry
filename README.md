# ChocoBerry Gift Assistant

Мобильное веб-приложение для кондитерской ChocoBerry: подбор подарка, каталог, работы, отзывы, контакты и скрытая мини-CMS для владельца.

## Локальный запуск

```bash
npm install
npm run dev
```

Для режима с общей админкой и серверным сохранением:

```bash
npm run build
npm run start
```

Админка открывается по адресу `/#admin`.

## Данные

Исходные данные лежат отдельно от логики:

- `src/data/products.json` - товары, цены, категории, описание, состав и фото.
- `src/data/gallery.json` - работы для раздела "Наши работы". Если массив пустой, сайт покажет "Работы скоро появятся".
- `src/data/reviews.json` - отзывы. Если массив пустой, сайт покажет "Отзывы скоро появятся".
- `src/data/contacts.json` - адрес, WhatsApp, Instagram и график.

У товара поле `images` хранит несколько фото:

```json
{
  "name": "Клубника в шоколаде",
  "price": 100,
  "category": "Клубника в шоколаде",
  "image": "https://res.cloudinary.com/.../main.jpg",
  "images": [
    "https://res.cloudinary.com/.../main.jpg",
    "https://res.cloudinary.com/.../detail.jpg"
  ]
}
```

## Cloudinary

Загрузка фото в админке отправляет изображение в Cloudinary. На Render локальные изображения не сохраняются.

Нужные переменные окружения:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` - можно оставить `chocoberry`

Ключи находятся в Cloudinary Dashboard: **Programmable Media -> Dashboard / API Keys**.

## Сохранение на Render Free

Render Free не гарантирует постоянное хранение файлов на диске. Поэтому JSON-данные мини-CMS можно сохранять в GitHub через GitHub Contents API.

Нужные переменные окружения:

- `GITHUB_TOKEN` - fine-grained или classic token с правом читать/писать contents репозитория.
- `GITHUB_REPO` - например `drag717/chocoberry`.
- `GITHUB_BRANCH` - обычно `main`.
- `GITHUB_DATA_PREFIX` - например `server-data`.

Если GitHub-переменные не заданы, приложение работает локально, но изменения на Render Free могут потеряться после перезапуска.

## Мини-CMS

В админке владелец может:

- добавлять, редактировать и удалять товары;
- менять цены, описания, размер и состав;
- загружать несколько фото товара;
- добавлять, редактировать и удалять работы;
- загружать несколько фото работы;
- добавлять, редактировать и удалять отзывы;
- добавлять фото к отзыву.

Фото сразу возвращаются Cloudinary URL и сохраняются в данных.

## Деплой

Проект подготовлен для Render Free через `Dockerfile` и `render.yaml`. Публичная витрина открывается на `/`, админка на `/#admin`.
