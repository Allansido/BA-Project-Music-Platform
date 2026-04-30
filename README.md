# BA-Project-Music-Platform

## Local database

This project uses a local PostgreSQL database for created user accounts.
Passwords are hashed with bcrypt before they are stored.

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

## Last.fm 1K dataset

This project expects the Last.fm 1K listening-history file in `dataset/raw/`.
The raw dataset is not committed because it is large, but the processed
`artistTags.json` and `artistSegments.json` files can be committed through Git
LFS.

1. Download the Last.fm 1K dataset from the official dataset page:

   [Last.fm Dataset - 1K users](http://ocelma.net/MusicRecommendationDataset/lastfm-1K.html)

2. Extract the downloaded archive. Inside it, find this file:

   ```txt
   userid-timestamp-artid-artname-traid-traname.tsv
   ```

3. Copy that file into the raw dataset folder:

   ```txt
   dataset/raw/userid-timestamp-artid-artname-traid-traname.tsv
   ```

4. Convert the raw TSV listening history into processed JSON:

   ```sh
   npm run lastfm:import
   ```

   This creates:

   ```txt
   dataset/processed/interactions.json
   ```

   `interactions.json` is ignored by Git because it is very large and can be
   regenerated from the raw TSV file.

5. Generate artist segment metadata:

   ```sh
   npm run artists:split
   ```

   This creates:

   ```txt
   dataset/processed/artistSegments.json
   ```

6. If you need Last.fm artist tags for genre-based recommendations, add your
   Last.fm API key to `.env`:

   ```env
   LASTFM_API_KEY=your-real-lastfm-api-key
   ```

   Then fetch artist tags:

   ```sh
   npm run lastfm:tags
   ```

   This creates or updates:

   ```txt
   dataset/processed/artistTags.json
   ```

   For faster tag fetching, you can tune the Last.fm fetcher:

   ```sh
   LASTFM_CONCURRENCY=2 LASTFM_REQUEST_DELAY_MS=500 npm run lastfm:tags
   ```

   On PowerShell, set those variables like this:

   ```powershell
   $env:LASTFM_CONCURRENCY="2"
   $env:LASTFM_REQUEST_DELAY_MS="500"
   npm run lastfm:tags
   ```
