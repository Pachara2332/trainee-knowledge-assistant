export async function GET() {
  const hasAuthSecret = Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const authUrl =
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || null;

  return Response.json({
    status: hasAuthSecret && hasDatabaseUrl ? "ok" : "degraded",
    auth: {
      hasSecret: hasAuthSecret,
      hasUrl: Boolean(authUrl),
      url: authUrl,
    },
    database: {
      configured: hasDatabaseUrl,
    },
  });
}
