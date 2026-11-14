# Prime Trade Inventory

Single-store inventory and sales operations app built with Next.js 16, React 19, Tailwind CSS, MongoDB/Mongoose, and JWT cookie authentication.

## Getting Started

Required environment variables:

```env
MONGODB_URI=
JWT_SECRET=
APP_URL=
RESEND_API_KEY=
PASSWORD_RESET_EMAIL_FROM=
```

Optional, for product images and the public website:

```env
# Cloudflare R2 bucket that stores product images. Uploads stay disabled until all five are set.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
# Public address of the bucket (custom domain), e.g. https://images.example.com
R2_PUBLIC_BASE_URL=
# Shared secret the public website sends to GET /api/public/catalog. The endpoint is off until set.
PUBLIC_CATALOG_TOKEN=
```

The R2 bucket needs a CORS rule allowing `PUT` with the `Content-Type` header from this app's address.

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Admin setup is available from the login page and should be run once.
- The app is configured for one business inventory context.
