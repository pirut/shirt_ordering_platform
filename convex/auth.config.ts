export default {
  providers: [
    {
      // Use a non-reserved env var name for your site URL.
      // Convex forbids overriding names starting with "CONVEX_".
      // Set this via `npx convex env set SITE_URL https://your-domain`.
      domain: process.env.SITE_URL,
      applicationID: "convex",
    },
  ],
};
