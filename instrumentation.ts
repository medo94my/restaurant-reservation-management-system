export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Warm the schema bootstrap at server start so the first request does not
    // pay for table creation. See lib/schema.ts.
    const { ensureSchema } = await import('@/lib/schema')
    await ensureSchema()
  }
}
