# What to Wear

A quick look before you head out: it checks the weather and suggests an outfit from clothes you actually own.

**Live:** https://dxms6lt12il94.cloudfront.net

## How to use it

1. **Pick a city.** Search for one, or tap **Use my location**.
2. **Read the Today tab.**
   - The weather card shows how it feels, the chance of rain, wind and UV, an hourly feels-like curve, and how much warmer or colder it is than the day before.
   - **Wear this today** lists one item per category (top, mid layer, outerwear, bottoms, shoes) plus anything to **bring**, like an umbrella.
   - **Tips** adds advice for the day, such as layering when the temperature swings.
   - Switch to **Tomorrow** to plan ahead. After 8 pm the app opens on tomorrow.
3. **Make the wardrobe yours.** It starts with a basic unisex wardrobe. In the **Wardrobe** tab:
   - Tap **Don't have** on anything you don't own, and it won't be suggested again.
   - Add your own items and pick which type each one behaves like.
4. **Keep a wishlist.** Items that would help show up under **Worth buying**. Add them to your **Wishlist** in one tap, then tap **Got it** once you buy one and it moves into your wardrobe.
5. **Settings** sit in the top bar: language (中文 / English), °C / °F, and light / dark / system theme.

### Signing in

You don't need an account. Everything you set up is saved in your browser.

Tap **Sign in to sync** to create an account with your email. Once you're signed in, your wardrobe, wishlist, city and settings are also saved to your account, so you get them back on another device or after clearing your browser. A dot next to **Sign out** shows the sync state.

| | Not signed in | Signed in |
|---|---|---|
| Weather and outfit suggestions | ✅ | ✅ |
| Wardrobe, wishlist, city and settings remembered | ✅ in this browser only | ✅ in this browser and in your account |
| Same data on your phone and computer | ❌ | ✅ |
| Kept after clearing site data or in a private window | ❌ | ✅ after you sign in again |

## Credits

Weather and geocoding by [Open-Meteo](https://open-meteo.com/), free for non-commercial use.

## Development

```bash
npm install
npm run dev     # local dev server on http://localhost:5173
npm test
```

Pushing to `main` deploys automatically: GitHub Actions runs the checks and AWS CodeBuild deploys. How it's built and deployed on AWS is written up in [`docs/aws-walkthrough.md`](docs/aws-walkthrough.md) (in Chinese).
