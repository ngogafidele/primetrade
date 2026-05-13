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

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Admin setup is available from the login page and should be run once.
- The app is configured for one business inventory context.
