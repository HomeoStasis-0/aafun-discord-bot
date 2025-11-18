# AAFUN Discord Bot

This is a Discord bot I made for my friends and I because I was bored.  
It runs on Node.js, Discord.js, and a bunch of random APIs.  
It does stuff like:

- Chatting with LLMs (Groq, etc)
- Spotify top tracks (with login)
- Giphy/tenor GIFs (with some cursed fallbacks)
- Birthday shoutouts (with GIFs)
- Meme auto-replies (type "meow", "erm", "kys", etc)
- `/restart` command for when things go sideways
- `/clear` to wipe your chat memory with the bot
- And whatever else I felt like adding at 2am

## How to Run

1. Clone this repo
2. Make a `.env` file (see below for what you need)
3. `npm install`
4. `npm start`
5. Invite the bot to your server and enjoy the chaos

**Never commit your `.env` or any secrets to this repo!**  
Add `.env` and any secret files to `.gitignore` (already set up).

### Example `.env` (do NOT commit this file)
```
DISCORD_TOKEN=your_discord_token
GROQ_API_KEY=your_groq_key
CLIENT_ID=your_discord_client_id
GUILD_ID=your_guild_id
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-app-url/callback
GIPHY_API_KEY=your_giphy_key
```

## Commands

- `/chat message:<text>` — Talk to the bot (LLM-powered)
- `/spotify login` — Link your Spotify account
- `/spotify toptracks` — Get your top 5 tracks
- `/randomgif [search]` — Get a random GIF (or type "rick", "meow", etc for surprises)
- `/clear` — Clear your chat memory with the bot
- `/restart` — Restarts the bot (Heroku only, don't abuse it)
- ...and more

## Funky Features

- Auto-deletes meme replies after 5 seconds (so you look even more sus)
- Birthday GIFs for users in `birthdays.txt` (not tracked in git)
- Handles both IPv4 and IPv6 (for the 3 people who care)
- Logs a bunch of stuff for debugging because I kept breaking it

## Contributing

You probably shouldn't, but if you want to, open a PR or DM me.

## License

MIT. Do whatever you want, just don't blame me if it breaks your server.

---

Made with ❤️, boredom, and too much caffeine.
