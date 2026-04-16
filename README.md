# BA-Project-Music-Platform

## Local database

This project uses a local PostgreSQL database for created user accounts.
Passwords are hashed with bcrypt before they are stored, so the database never
stores plain-text passwords.

1. Copy the example environment file and adjust values if needed:

   ```sh
   cp .env.example .env
   ```

2. Start PostgreSQL with Docker:

   ```sh
   npm run db:up
   ```

   If this prints `docker: command not found`, install and start Docker Desktop
   first. The project maps Postgres to local port `5433` so it does not collide
   with a separate Postgres already using `5432` on your machine.

3. Install dependencies and run the backend:

   ```sh
   npm install
   npm run dev
   ```

The backend creates the `users` table automatically on startup. The default
connection string points at the Docker database:

```txt
postgres://music_platform:music_platform@localhost:5433/music_platform
```

The Last.fm dataset can stay in the local `dataset/` directory. It is ignored by
Git and remains separate from the auth database, so large raw or processed
dataset files do not get mixed into account storage.
